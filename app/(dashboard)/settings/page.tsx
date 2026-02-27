"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  // Obtener datos del usuario
  const { data: user, isLoading } = trpc.auth.me.useQuery();

  // Mutations
  const updateProfile = trpc.auth.updateProfile.useMutation();
  const utils = trpc.useUtils();

  // Cargar datos cuando el usuario esté disponible
  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user]);

  const handleSaveProfile = async () => {
    try {
      await updateProfile.mutateAsync({ name });
      utils.auth.me.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Error guardando perfil:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-muted rounded mb-2" />
          <div className="h-4 w-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-muted-foreground mt-2">
          Gestiona tu cuenta y preferencias
        </p>
      </div>

      <div className="space-y-6">
        {/* Suscripción */}
        <Card>
          <CardHeader>
            <CardTitle>Suscripción</CardTitle>
            <CardDescription>
              Plan actual y estado de pago
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-semibold">
                  {user?.tenant?.plan === "PRO" ? "Plan Pro" :
                   user?.tenant?.plan === "BASIC" ? "Plan Básico" :
                   user?.tenant?.plan || "Plan Gratuito"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {user?.tenant?.name || "Tu organización"}
                </p>
              </div>
              <Link href="/pricing">
                <Button>Mejorar Plan</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Cuentas de Trading */}
        <Card>
          <CardHeader>
            <CardTitle>Cuentas de Trading</CardTitle>
            <CardDescription>
              Conecta tus cuentas de MetaTrader
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground mb-4">
                Gestiona tus cuentas MT5 desde la sección del Bot
              </p>
              <Link href="/bot">
                <Button>Ir a Bot</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Perfil */}
        <Card>
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
            <CardDescription>
              Información de tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-sm font-medium mb-2 block">
                Nombre
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Tu nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={updateProfile.isPending}
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-sm font-medium mb-2 block">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                disabled
                value={user?.email || ""}
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                El email no se puede cambiar
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={handleSaveProfile}
                disabled={updateProfile.isPending || name === user?.name}
              >
                {updateProfile.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Cambios"
                )}
              </Button>
              {saved && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Guardado
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Seguridad */}
        <Card>
          <CardHeader>
            <CardTitle>Seguridad</CardTitle>
            <CardDescription>
              Cambia tu contraseña de acceso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm mb-4">
              Para cambiar tu contraseña, cierra sesión y usa la opción "Olvidé mi contraseña" en la pantalla de login.
            </p>
            <Link href="/login">
              <Button variant="outline">Cerrar Sesión</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
