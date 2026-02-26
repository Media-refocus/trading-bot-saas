"use client";

import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";

// Formateador de tiempo simple (sin date-fns)
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Ahora mismo";
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return new Date(date).toLocaleDateString("es-ES");
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);

  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery();
  const { data: notifications, refetch } = trpc.notifications.list.useQuery({
    limit: 10,
    unreadOnly: false,
  });

  const markAsRead = trpc.notifications.markAsRead.useMutation();
  const markAllRead = trpc.notifications.markAllRead.useMutation();

  const handleMarkAllRead = async () => {
    await markAllRead.mutateAsync();
    refetch();
  };

  const handleMarkAsRead = async (id: string) => {
    await markAsRead.mutateAsync({ id });
    refetch();
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "SUCCESS":
        return "text-green-500";
      case "WARNING":
        return "text-yellow-500";
      case "ERROR":
        return "text-red-500";
      default:
        return "text-blue-500";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "SUCCESS":
        return "\u2713";
      case "WARNING":
        return "\u26A0";
      case "ERROR":
        return "\u2715";
      default:
        return "\u2139";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount && unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center"
              variant="destructive"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h4 className="font-semibold">Notificaciones</h4>
          {unreadCount && unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="h-8"
            >
              <Check className="h-4 w-4 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notifications && notifications.length > 0 ? (
            <div className="divide-y divide-border">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                    !n.isRead ? "bg-muted/30" : ""
                  }`}
                  onClick={() => handleMarkAsRead(n.id)}
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 ${getTypeColor(n.type)}`}>
                      {getTypeIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {n.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimeAgo(new Date(n.createdAt))}
                      </p>
                    </div>
                    {!n.isRead && (
                      <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No hay notificaciones</p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
