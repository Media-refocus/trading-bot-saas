"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

interface BotStatus {
  configured: boolean;
  isOnline: boolean;
  connection: ConnectionStatus;
  positions: Position[];
  metrics: Metrics;
  config: {
    lotSize: number;
    maxLevels: number;
    gridDistance: number;
    takeProfit: number;
    isActive: boolean;
  };
}

export default function DashboardPage() {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBotStatus();
    const interval = setInterval(fetchBotStatus, 10000); // Refresh every 10s
    return () => {
      fetchBotStatus();
    };
  }, []);

  const fetchBotStatus = async () => {
    try {
      const res = await fetch("/api/bot/status");
      const data = await res.json();
      if (data.success) {
        setBotStatus(data);
      }
    } catch (error) {
      console.error("Error fetching bot status:", error);
    } finally {
      setLoading(false);
    }
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

  // Main content
  return (
    <div className="space-y-8">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Estado del Bot</CardTitle>
              <CardDescription>
                Estado de conexion en tiempo real
              </CardDescription>
            </div>
            <Badge variant={botStatus?.connection?.isOnline ? "default" : "secondary"}>
              {botStatus?.connection?.isOnline ? "Conectado" : "Desconectado"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${botStatus?.connection?.isOnline ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></div>
            <div>
              <p className="font-medium">
                {botStatus?.connection?.isOnline ? "Bot operando normalmente" : "Bot desconectado"}
              </p>
              {botStatus?.connection?.lastSeen && (
                <p className="text-sm text-muted-foreground">
                  Ultima conexion: {new Date(botStatus.connection.lastSeen).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Cards */}
      <div className="grid md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Operaciones Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {botStatus?.metrics?.todayTrades ?? 0}
            </div>
            <p className="text-sm text-muted-foreground mt-2">Hoy</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Posiciones Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {botStatus?.metrics?.openPositions ?? 1}
            </div>
            <p className="text-sm text-muted-foreground mt-2">Nivel {botStatus?.metrics?.currentLevel ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profit Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${botStatus?.metrics?.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {botStatus?.metrics?.totalProfit >= 0 ? "+" : ""}{botStatus?.metrics.totalProfit.toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground mt-2">Acumulado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profit Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${botStatus?.metrics?.todayProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {botStatus?.metrics?.todayProfit >= 0 ? "+" : ""}{botStatus?.metrics.todayProfit.toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground mt-2">Hoy</p>
          </CardContent>
        </Card>
      </div>

      {/* Positions table */}
      {botStatus?.positions && botStatus.positions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Posiciones Abiertas ({botStatus.positions.length})</CardTitle>
            <CardDescription>
              Detalles de posiciones actuales
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="flex gap-4">
        <Button variant="outline" onClick={fetchBotStatus}>
          Refrescar
        </Button>
        <Button variant="outline" asChild>
          <Link href="/setup">Setup</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/backtester">Backtester</Link>
        </Button>
      </div>
    </div>
  );
}
