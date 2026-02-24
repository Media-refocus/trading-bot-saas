"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface BotSettings {
  lotSize: number;
  maxLevels: number;
  gridDistance: number;
  takeProfit: number;
  trailingActivate: number | null;
  trailingStep: number | null;
  trailingBack: number | null;
  defaultRestriction: string | null;
}

interface PlanLimits {
  maxLevels: number;
  maxPositions: number;
  hasTrailingSL: boolean;
  hasAdvancedGrid: boolean;
}

interface SettingsResponse {
  success: boolean;
  config: BotSettings | null;
  planLimits: PlanLimits;
  planName: string;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [formData, setFormData] = useState<BotSettings>({
    lotSize: 0.01,
    maxLevels: 3,
    gridDistance: 10,
    takeProfit: 20,
    trailingActivate: 30,
    trailingStep: 10,
    trailingBack: 20,
    defaultRestriction: null,
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/bot/settings");
      const data = await res.json();
      setSettings(data);
      if (data.config) {
        setFormData(data.config);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/bot/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: data.message });
        setSettings((prev) => prev ? { ...prev, config: data.config } : null);
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof BotSettings, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Configuracion</h1>
        <p className="text-muted-foreground mt-2">
          Gestiona tu cuenta y preferencias
        </p>
      </div>

      {/* Config del Bot */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Configuracion del Bot</CardTitle>
              <CardDescription>
                Ajusta los parametros de operativa
              </CardDescription>
            </div>
            {settings?.planName && (
              <Badge variant="secondary">{settings.planName}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!settings?.config ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                Primero configura tu bot en la pagina de instalacion
              </p>
              <Button asChild>
                <a href="/setup">Ir a Instalacion</a>
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Trading Params */}
              <div>
                <h4 className="font-medium mb-4">Parametros de Trading</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lotSize">Lote</Label>
                    <Input
                      id="lotSize"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="1.0"
                      value={formData.lotSize}
                      onChange={(e) => updateField("lotSize", parseFloat(e.target.value) || 0.01)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxLevels">Niveles Max</Label>
                    <Input
                      id="maxLevels"
                      type="number"
                      min="1"
                      max={settings.planLimits.maxLevels}
                      value={formData.maxLevels}
                      onChange={(e) => updateField("maxLevels", parseInt(e.target.value) || 1)}
                    />
                    <p className="text-xs text-muted-foreground">Limite: {settings.planLimits.maxLevels}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gridDistance">Distancia (pips)</Label>
                    <Input
                      id="gridDistance"
                      type="number"
                      min="5"
                      max="100"
                      value={formData.gridDistance}
                      onChange={(e) => updateField("gridDistance", parseInt(e.target.value) || 5)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="takeProfit">TP (pips)</Label>
                    <Input
                      id="takeProfit"
                      type="number"
                      min="5"
                      max="200"
                      value={formData.takeProfit}
                      onChange={(e) => updateField("takeProfit", parseInt(e.target.value) || 5)}
                    />
                  </div>
                </div>
              </div>

              {/* Trailing SL */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h4 className="font-medium">Trailing Stop Loss</h4>
                  {!settings.planLimits.hasTrailingSL && (
                    <Badge variant="outline">Pro</Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="trailingActivate">Activar (pips)</Label>
                    <Input
                      id="trailingActivate"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.trailingActivate ?? ""}
                      onChange={(e) => updateField("trailingActivate", e.target.value ? parseInt(e.target.value) : null)}
                      disabled={!settings.planLimits.hasTrailingSL}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trailingStep">Paso (pips)</Label>
                    <Input
                      id="trailingStep"
                      type="number"
                      min="5"
                      max="50"
                      value={formData.trailingStep ?? ""}
                      onChange={(e) => updateField("trailingStep", e.target.value ? parseInt(e.target.value) : null)}
                      disabled={!settings.planLimits.hasTrailingSL}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trailingBack">Back (pips)</Label>
                    <Input
                      id="trailingBack"
                      type="number"
                      min="10"
                      max="100"
                      value={formData.trailingBack ?? ""}
                      onChange={(e) => updateField("trailingBack", e.target.value ? parseInt(e.target.value) : null)}
                      disabled={!settings.planLimits.hasTrailingSL}
                    />
                  </div>
                </div>
              </div>

              {/* Restricciones */}
              <div>
                <h4 className="font-medium mb-4">Restriccion por Defecto</h4>
                <select
                  className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.defaultRestriction || ""}
                  onChange={(e) => updateField("defaultRestriction", e.target.value || null)}
                >
                  <option value="">Sin restriccion (segun canal)</option>
                  <option value="RIESGO">RIESGO - Solo 1 promedio</option>
                  <option value="SIN_PROMEDIOS">SIN_PROMEDIOS</option>
                  <option value="SOLO_1_PROMEDIO">SOLO_1_PROMEDIO</option>
                </select>
              </div>

              {/* Mensaje */}
              {message && (
                <div className={`p-3 rounded-lg text-sm ${
                  message.type === "success"
                    ? "bg-green-50 border border-green-200 text-green-800"
                    : "bg-red-50 border border-red-200 text-red-800"
                }`}>
                  {message.text}
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
                <Button variant="outline" onClick={fetchSettings}>
                  Descartar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suscripcion */}
      <Card>
        <CardHeader>
          <CardTitle>Suscripcion</CardTitle>
          <CardDescription>
            Plan actual y estado de pago
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-semibold">{settings?.planName || "Plan Gratuito"}</h3>
              <p className="text-sm text-muted-foreground">
                {settings?.planLimits ? `${settings.planLimits.maxLevels} niveles, ${settings.planLimits.maxPositions} posicion` : "Funcionalidades limitadas"}
              </p>
            </div>
            <Button>Mejorar Plan</Button>
          </div>
        </CardContent>
      </Card>

      {/* Cuentas MT5 */}
      <Card>
        <CardHeader>
          <CardTitle>Cuentas de Trading</CardTitle>
          <CardDescription>
            Cuentas MT5 conectadas al bot
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-8 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground mb-4">
              Las credenciales MT5 se configuran en el VPS, no aqui
            </p>
            <p className="text-sm text-muted-foreground">
              Edita el archivo .env en tu servidor
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
