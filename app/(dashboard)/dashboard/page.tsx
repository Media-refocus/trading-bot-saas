"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProfitChart } from "@/components/charts/profit-chart";
import { TradesChart } from "@/components/charts/trades-chart";
import { WinRateCard } from "@/components/charts/win-rate-card";

interface ConnectionStatus {
  isOnline: boolean;
  lastSeen: string | null;
  status: string;
  mt5Connected: boolean;
  error: string | null;
  platform: string | null;
  version: string | null;
}

interface Position {
  id: string;
  side: string;
  symbol: string;
  lotSize: number;
  openPrice: number;
  level: number;
  openedAt: string;
}

interface Metrics {
  todayTrades: number;
  todayProfit: number;
  totalTrades: number;
  totalProfit: number;
  openPositions: number;
  currentLevel: number;
  currentSide: string | null;
}

interface SecurityInfo {
  apiKeyStatus: string;
  apiKeyCreatedAt: string | null;
  lastRotation: string | null;
  requestCount: number;
}

interface ChartData {
  profit: Array<{ date: string; profit: number; cumulative: number }>;
  trades: Array<{ date: string; trades: number; wins: number; losses: number }>;
  winRate: {
    winRate: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    avgProfit: number;
    avgLoss: number;
  };
}

interface BotStatus {
  configured: boolean;
  isOnline: boolean;
  connection: ConnectionStatus;
  positions: Position[];
  metrics: Metrics;
  security?: SecurityInfo;
  charts?: ChartData;
  config: {
    lotSize: number;
    maxLevels: number;
    gridDistance: number;
    takeProfit: number;
    isActive: boolean;
    paperTradingMode: boolean;
  };
}

// Utilidad para formatear tiempo transcurrido
function timeAgo(dateString: string | null): string {
  if (!dateString) return "Nunca";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Hace un momento";
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  return `Hace ${diffDays} dias`;
}

// Componente de Skeleton para estados de carga
function MetricSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 bg-muted rounded w-24"></div>
      <div className="h-8 bg-muted rounded w-16"></div>
      <div className="h-3 bg-muted rounded w-20"></div>
    </div>
  );
}

// Componente de Tooltip simple usando title HTML
function TooltipWrapper({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="cursor-help" title={text}>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);

  const fetchBotStatus = useCallback(async (showRefreshing = true) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const res = await fetch("/api/bot/status");
      const data = await res.json();
      if (data.success) {
        setBotStatus(data);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error("Error fetching bot status:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBotStatus(false);
    const interval = setInterval(() => fetchBotStatus(false), 10000);
    return () => clearInterval(interval);
  }, [fetchBotStatus]);

  // Funciones para acciones
  const handleStopBot = async () => {
    try {
      const res = await fetch("/api/bot/stop", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert("Bot detenido correctamente");
        fetchBotStatus();
      } else {
        alert("Error al detener el bot: " + (data.error || "Error desconocido"));
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error de conexion");
    }
    setStopConfirmOpen(false);
  };

  const handleSyncConfig = async () => {
    try {
      const res = await fetch("/api/bot/settings", { method: "GET" });
      const data = await res.json();
      if (data.success) {
        alert("Configuracion sincronizada correctamente");
        fetchBotStatus();
      } else {
        alert("Error al sincronizar: " + (data.error || "Error desconocido"));
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error de conexion");
    }
    setSyncConfirmOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-1 border-primary"></div>
      </div>
    );
  }

  // If not configured, show setup prompt
  if (!botStatus?.configured) {
    return (
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Bot no configurado</CardTitle>
            <CardDescription>
              Primero configura tu bot de trading
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Aun no has configurado tu bot de trading. Ve a setup para comenzar.
            </p>
            <Button asChild>
              <Link href="/setup">Ir a Configuracion</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPaperMode = botStatus?.config?.paperTradingMode ?? false;

  // Main content
  return (
    <div className="space-y-8">
      {/* Header con indicador de modo y ultima actualizacion */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            Dashboard
            {isPaperMode && (
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-sm">
                MODO DEMO
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Panel de control del bot de trading
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {refreshing && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-1 border-primary"></div>
          )}
          {lastUpdate && (
            <span>Actualizado: {lastUpdate.toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                Estado del Bot
                {isPaperMode && (
                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                    DEMO
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Estado de conexion en tiempo real
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={botStatus?.connection?.isOnline ? "default" : "secondary"}>
                {botStatus?.connection?.isOnline ? "Conectado" : "Desconectado"}
              </Badge>
              <Badge
                variant={botStatus?.connection?.mt5Connected ? "default" : "destructive"}
                className={botStatus?.connection?.mt5Connected ? "bg-green-600" : ""}
              >
                MT5: {botStatus?.connection?.mt5Connected ? "OK" : "OFF"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${botStatus?.connection?.isOnline ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></div>
              <div className="flex-1">
                <p className="font-medium">
                  {botStatus?.connection?.isOnline ? "Bot operando normalmente" : "Bot desconectado"}
                </p>
                {botStatus?.connection?.error && (
                  <p className="text-sm text-destructive">
                    Error: {botStatus.connection.error}
                  </p>
                )}
              </div>
            </div>

            {/* Info adicional: version, plataforma, ultima conexion */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Ultima conexion</p>
                <p className="font-medium">{timeAgo(botStatus?.connection?.lastSeen)}</p>
              </div>
              {botStatus?.connection?.version && (
                <div>
                  <p className="text-muted-foreground">Version</p>
                  <p className="font-medium">{botStatus.connection.version}</p>
                </div>
              )}
              {botStatus?.connection?.platform && (
                <div>
                  <p className="text-muted-foreground">Plataforma</p>
                  <p className="font-medium">{botStatus.connection.platform}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Cards */}
      <div className="grid md:grid-cols-4 gap-6">
        <TooltipWrapper text="Numero de operaciones completadas hoy (desde las 00:00)">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Operaciones Hoy
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <MetricSkeleton />
              ) : (
                <>
                  <div className="text-3xl font-bold">
                    {botStatus?.metrics?.todayTrades ?? 0}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Hoy</p>
                </>
              )}
            </CardContent>
          </Card>
        </TooltipWrapper>

        <TooltipWrapper text="Posiciones actualmente abiertas en el mercado">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Posiciones Abiertas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <MetricSkeleton />
              ) : (
                <>
                  <div className="text-3xl font-bold">
                    {botStatus?.metrics?.openPositions ?? 0}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Nivel {botStatus?.metrics?.currentLevel ?? 0}
                    {botStatus?.metrics?.currentSide && (
                      <span className="ml-2">
                        ({botStatus.metrics.currentSide === "BUY" ? "Compra" : "Venta"})
                      </span>
                    )}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </TooltipWrapper>

        <TooltipWrapper text="Beneficio o perdida acumulado desde el inicio del bot">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Profit Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <MetricSkeleton />
              ) : (
                <>
                  <div className={`text-3xl font-bold ${botStatus?.metrics?.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {botStatus?.metrics?.totalProfit >= 0 ? "+" : ""}{botStatus?.metrics?.totalProfit?.toFixed(2) ?? "0.00"}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Acumulado</p>
                </>
              )}
            </CardContent>
          </Card>
        </TooltipWrapper>

        <TooltipWrapper text="Beneficio o perdida obtenido hoy (desde las 00:00)">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Profit Hoy
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <MetricSkeleton />
              ) : (
                <>
                  <div className={`text-3xl font-bold ${botStatus?.metrics?.todayProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {botStatus?.metrics?.todayProfit >= 0 ? "+" : ""}{botStatus?.metrics?.todayProfit?.toFixed(2) ?? "0.00"}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Hoy</p>
                </>
              )}
            </CardContent>
          </Card>
        </TooltipWrapper>
      </div>

      {/* Seccion de Rendimiento - Graficos */}
      {botStatus?.charts && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Rendimiento</h2>

          {/* Grid de 2 columnas para graficos principales */}
          <div className="grid lg:grid-cols-2 gap-6">
            <ProfitChart data={botStatus.charts.profit} />
            <TradesChart data={botStatus.charts.trades} />
          </div>

          {/* Win Rate Card centrada */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-start-2">
              <WinRateCard
                winRate={botStatus.charts.winRate.winRate}
                totalTrades={botStatus.charts.winRate.totalTrades}
                winningTrades={botStatus.charts.winRate.winningTrades}
                losingTrades={botStatus.charts.winRate.losingTrades}
                avgProfit={botStatus.charts.winRate.avgProfit}
                avgLoss={botStatus.charts.winRate.avgLoss}
              />
            </div>
          </div>
        </div>
      )}

      {/* Positions table o estado vacio */}
      <Card>
        <CardHeader>
          <CardTitle>Posiciones Abiertas</CardTitle>
          <CardDescription>
            Detalles de posiciones actuales en el mercado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {botStatus?.positions && botStatus.positions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Side</th>
                    <th className="text-left py-2">Symbol</th>
                    <th className="text-left py-2">Lote</th>
                    <th className="text-left py-2">Price</th>
                    <th className="text-left py-2">Level</th>
                    <th className="text-left py-2">Opened</th>
                  </tr>
                </thead>
                <tbody>
                  {botStatus.positions.map((pos) => (
                    <tr key={pos.id} className="border-b">
                      <td>
                        <Badge variant={pos.side === "BUY" ? "default" : "destructive"}>
                          {pos.side}
                        </Badge>
                      </td>
                      <td className="py-2">{pos.symbol}</td>
                      <td className="py-2">{pos.lotSize}</td>
                      <td className="py-2">{pos.openPrice}</td>
                      <td className="py-2">{pos.level}</td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(pos.openedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-4xl mb-2">📭</div>
              <p className="font-medium">No hay posiciones abiertas</p>
              <p className="text-sm">El bot esperara la proxima senal para operar</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Info */}
      {botStatus?.security && (
        <Card>
          <CardHeader>
            <CardTitle>Seguridad</CardTitle>
            <CardDescription>
              Estado de la API key y seguridad
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Estado API Key</p>
                <Badge variant={botStatus.security.apiKeyStatus === "ACTIVE" ? "default" : "secondary"}>
                  {botStatus.security.apiKeyStatus}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Requests (esta hora)</p>
                <p className="font-medium">{botStatus.security.requestCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions mejorados */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rapidas</CardTitle>
          <CardDescription>
            Controla el bot y sincroniza la configuracion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => fetchBotStatus(true)}
              disabled={refreshing}
            >
              {refreshing ? "Actualizando..." : "Refrescar"}
            </Button>

            <Button variant="outline" asChild>
              <Link href="/setup">Setup</Link>
            </Button>

            <Button variant="outline" asChild>
              <Link href="/settings">Configuracion</Link>
            </Button>

            <Button variant="outline" asChild>
              <Link href="/backtester">Backtester</Link>
            </Button>

            {/* Boton Sincronizar Config con confirmacion */}
            {syncConfirmOpen ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncConfig}
                >
                  Confirmar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSyncConfirmOpen(false)}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setSyncConfirmOpen(true)}
              >
                Sincronizar Config
              </Button>
            )}

            {/* Boton Detener Bot con confirmacion */}
            {stopConfirmOpen ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStopBot}
                >
                  Confirmar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStopConfirmOpen(false)}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                variant="destructive"
                onClick={() => setStopConfirmOpen(true)}
              >
                Detener Bot
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
