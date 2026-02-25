"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
  readAt?: string;
}

interface AlertsResponse {
  success: boolean;
  alerts: Alert[];
  unreadCount: number;
}

// Iconos por tipo de alerta
const ALERT_ICONS: Record<string, string> = {
  BOT_OFFLINE: "Desconectado",
  BOT_ERROR: "Error",
  HIGH_DRAWDOWN: "Riesgo",
  SUBSCRIPTION_EXPIRING: "Suscripcion",
};

// Colores por tipo de alerta
const ALERT_COLORS: Record<string, string> = {
  BOT_OFFLINE: "text-orange-500",
  BOT_ERROR: "text-red-500",
  HIGH_DRAWDOWN: "text-yellow-500",
  SUBSCRIPTION_EXPIRING: "text-blue-500",
};

export default function AlertsBadge() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchAlerts();
    // Refresh cada 30 segundos
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await fetch("/api/alerts?limit=10");
      const data: AlertsResponse = await res.json();
      if (data.success) {
        setAlerts(data.alerts);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error("Error obteniendo alertas:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (alertId: string) => {
    try {
      const res = await fetch(`/api/alerts/${alertId}/read`, {
        method: "PUT",
      });
      const data = await res.json();
      if (data.success) {
        // Actualizar estado local
        setAlerts((prev) =>
          prev.map((a) =>
            a.id === alertId ? { ...a, read: true, readAt: new Date().toISOString() } : a
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error marcando alerta como leida:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      // Marcar todas las alertas no leidas
      const unreadAlerts = alerts.filter((a) => !a.read);
      await Promise.all(unreadAlerts.map((a) => markAsRead(a.id)));
    } catch (error) {
      console.error("Error marcando todas las alertas como leidas:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Hace un momento";
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays} dias`;
    return date.toLocaleDateString("es-ES");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Alertas</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-auto py-1 px-2"
              onClick={markAllAsRead}
            >
              Marcar todas como leidas
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">
              Cargando...
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No hay alertas
            </div>
          ) : (
            <div className="divide-y">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    "p-3 hover:bg-muted/50 cursor-pointer transition-colors",
                    !alert.read && "bg-muted/30"
                  )}
                  onClick={() => !alert.read && markAsRead(alert.id)}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                        !alert.read ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-xs font-medium",
                            ALERT_COLORS[alert.type] || "text-muted-foreground"
                          )}
                        >
                          {ALERT_ICONS[alert.type] || alert.type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(alert.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{alert.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {alerts.length > 0 && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                setOpen(false);
                // Navigate to alerts page if needed
              }}
            >
              Ver todas las alertas
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
