"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircle2,
  Circle,
  Server,
  Key,
  CreditCard,
  Check,
  Copy,
  ExternalLink,
  Loader2,
} from "lucide-react";

interface OnboardingStatus {
  planName: string;
  planId: string | null;
  implementationFeePaid: boolean;
  needsImplementationFee: boolean;
  implementationFeeAmount: number | null;
  vpsAccessGranted: boolean;
  onboardingCompleted: boolean;
}

const STEPS = [
  { id: 1, title: "Seleccionar plan", description: "Elige el plan que mejor se adapte a tu capital" },
  { id: 2, title: "Pagar implementacion", description: "Fee unico de 97€ para Starter (incluido en Trader+)" },
  { id: 3, title: "Acceso VPS", description: "Proporciona acceso a tu VPS para la instalacion" },
  { id: 4, title: "Configurar MT5", description: "Introduce tus credenciales de MetaTrader 5" },
  { id: 5, title: "Activar bot", description: "El bot comienza a operar automaticamente" },
];

export default function OnboardingPage() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [vpsHost, setVpsHost] = useState("");
  const [vpsUser, setVpsUser] = useState("");
  const [vpsPassword, setVpsPassword] = useState("");
  const [mt5Login, setMt5Login] = useState("");
  const [mt5Password, setMt5Password] = useState("");
  const [mt5Server, setMt5Server] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/onboarding/status");
      const data = await res.json();
      if (data.success) {
        setStatus(data);
      }
    } catch (error) {
      console.error("Error fetching onboarding status:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleVpsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/vps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: vpsHost, user: vpsUser, password: vpsPassword }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchStatus();
        alert("Datos de VPS enviados correctamente. Nos pondremos en contacto pronto.");
      } else {
        alert(data.error || "Error al enviar datos");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error al enviar datos");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMt5Submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/mt5", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: mt5Login, password: mt5Password, server: mt5Server }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchStatus();
        alert("Credenciales MT5 guardadas correctamente");
      } else {
        alert(data.error || "Error al guardar credenciales");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error al guardar credenciales");
    } finally {
      setSubmitting(false);
    }
  }

  function getCurrentStep(): number {
    if (!status) return 1;
    if (!status.planId) return 1;
    if (status.needsImplementationFee && !status.implementationFeePaid) return 2;
    if (!status.vpsAccessGranted) return 3;
    if (!status.onboardingCompleted) return 4;
    return 5;
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Cargando estado del onboarding...</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>No se pudo cargar el estado del onboarding</AlertDescription>
        </Alert>
      </div>
    );
  }

  const currentStep = getCurrentStep();

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Configuracion del Bot</h1>
        <p className="text-muted-foreground">
          Sigue estos pasos para empezar a operar con el bot
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex flex-col items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                  step.id < currentStep
                    ? "bg-green-500 text-white"
                    : step.id === currentStep
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step.id < currentStep ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <span>{step.id}</span>
                )}
              </div>
              <span className="text-xs text-center hidden md:block">{step.title}</span>
            </div>
          ))}
        </div>
        <div className="h-1 bg-muted mt-4 rounded">
          <div
            className="h-full bg-primary rounded transition-all"
            style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Step 1: No plan selected */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Circle className="w-5 h-5" />
              Selecciona un plan
            </CardTitle>
            <CardDescription>
              Ve a la pagina de pricing para elegir el plan adecuado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/pricing">
                Ver planes <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Implementation fee pending */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Pagar fee de implementacion
            </CardTitle>
            <CardDescription>
              Plan {status.planName} - Fee de {status.implementationFeeAmount}€
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTitle>Instrucciones de pago</AlertTitle>
              <AlertDescription>
                <p className="mb-2">Realiza una transferencia o Bizum al siguiente contacto:</p>
                <p><strong>WhatsApp:</strong> +34 XXX XXX XXX</p>
                <p><strong>Concepto:</strong> Bot {status.planName} - {status.implementationFeeAmount}€</p>
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              Una vez confirmado el pago, te notificaremos por email para continuar con la configuracion.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step 3: VPS Access */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Acceso al VPS
            </CardTitle>
            <CardDescription>
              Proporciona los datos de acceso a tu VPS para instalar el bot
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVpsSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vps-host">IP o Hostname del VPS</Label>
                  <Input
                    id="vps-host"
                    placeholder="192.168.1.100 o vps.tudominio.com"
                    value={vpsHost}
                    onChange={(e) => setVpsHost(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vps-user">Usuario</Label>
                  <Input
                    id="vps-user"
                    placeholder="Administrator"
                    value={vpsUser}
                    onChange={(e) => setVpsUser(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vps-password">Contrasena</Label>
                <Input
                  id="vps-password"
                  type="password"
                  placeholder="Tu contrasena de RDP/SSH"
                  value={vpsPassword}
                  onChange={(e) => setVpsPassword(e.target.value)}
                  required
                />
              </div>
              <Alert>
                <AlertDescription className="text-sm">
                  <strong>Seguridad:</strong> Tus credenciales se almacenan encriptadas.
                  Una vez completada la instalacion, podras cambiar la contrasena.
                </AlertDescription>
              </Alert>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar datos de VPS"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 4: MT5 Credentials */}
      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Credenciales MetaTrader 5
            </CardTitle>
            <CardDescription>
              Introduce los datos de tu cuenta de trading
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleMt5Submit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mt5-login">Login (Cuenta)</Label>
                  <Input
                    id="mt5-login"
                    placeholder="12345678"
                    value={mt5Login}
                    onChange={(e) => setMt5Login(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mt5-server">Servidor</Label>
                  <Input
                    id="mt5-server"
                    placeholder="VTMarkets-Demo"
                    value={mt5Server}
                    onChange={(e) => setMt5Server(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mt5-password">Contrasena</Label>
                <Input
                  id="mt5-password"
                  type="password"
                  placeholder="Contrasena de tu cuenta MT5"
                  value={mt5Password}
                  onChange={(e) => setMt5Password(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar credenciales"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Completed */}
      {currentStep === 5 && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-6 h-6" />
              Bot Activado
            </CardTitle>
            <CardDescription>
              Tu bot esta configurado y listo para operar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Plan: {status.planName}</p>
                <p className="text-sm text-muted-foreground">Bot operativo</p>
              </div>
              <Badge variant="default" className="bg-green-500">Activo</Badge>
            </div>
            <div className="flex gap-4">
              <Button asChild>
                <a href="/dashboard">Ir al Dashboard</a>
              </Button>
              <Button asChild variant="outline">
                <a href="/settings">Configurar bot</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Box */}
      <div className="mt-8 p-6 bg-muted/50 rounded-lg">
        <h3 className="font-semibold mb-2">¿Necesitas ayuda?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Si tienes cualquier duda durante el proceso de configuracion, contactanos:
        </p>
        <ul className="text-sm space-y-2">
          <li><strong>Telegram:</strong> @refuelparts</li>
          <li><strong>Email:</strong> soporte@refuelparts.com</li>
          <li><strong>WhatsApp:</strong> +34 XXX XXX XXX</li>
        </ul>
      </div>
    </div>
  );
}
