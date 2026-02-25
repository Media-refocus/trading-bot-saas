/**
 * API de Onboarding - VPS Access
 * ===============================
 *
 * POST: Guarda los datos de acceso al VPS del cliente
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { host, user, password } = body;

    if (!host || !user || !password) {
      return NextResponse.json(
        { error: "Host, usuario y contrasena son requeridos" },
        { status: 400 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { tenant: true },
    });

    if (!dbUser?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    // Crear o actualizar los datos de VPS
    await prisma.vpsAccess.upsert({
      where: { tenantId: dbUser.tenant.id },
      update: {
        host,
        username: user,
        password, // TODO: Encriptar properly
      },
      create: {
        tenantId: dbUser.tenant.id,
        host,
        username: user,
        password, // TODO: Encriptar properly
      },
    });

    // Marcar que el acceso VPS ha sido concedido
    await prisma.tenant.update({
      where: { id: dbUser.tenant.id },
      data: { vpsAccessGranted: true },
    });

    // Crear alerta para notificar al equipo
    await prisma.alert.create({
      data: {
        tenantId: dbUser.tenant.id,
        type: "VPS_ACCESS_GRANTED",
        message: `Nuevo acceso VPS: ${host} (${user})`,
        metadata: { host, user },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Datos de VPS guardados correctamente",
    });
  } catch (error) {
    console.error("Error guardando datos de VPS:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
