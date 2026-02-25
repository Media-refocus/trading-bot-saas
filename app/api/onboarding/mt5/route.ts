/**
 * API de Onboarding - MT5 Credentials
 * ====================================
 *
 * POST: Guarda las credenciales de MetaTrader 5
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
    const { login, password, server } = body;

    if (!login || !password || !server) {
      return NextResponse.json(
        { error: "Login, contrasena y servidor son requeridos" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { tenant: true },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    // Crear o actualizar la cuenta de trading
    const existingAccount = await prisma.tradingAccount.findFirst({
      where: {
        tenantId: user.tenant.id,
        platform: "MT5",
      },
    });

    if (existingAccount) {
      // Actualizar cuenta existente
      await prisma.tradingAccount.update({
        where: { id: existingAccount.id },
        data: {
          accountNumber: login,
          server: server,
          encryptedApiKey: password, // TODO: Encriptar properly
        },
      });
    } else {
      // Crear nueva cuenta
      await prisma.tradingAccount.create({
        data: {
          tenantId: user.tenant.id,
          userId: user.id,
          broker: "Desconocido",
          accountNumber: login,
          platform: "MT5",
          server: server,
          encryptedApiKey: password, // TODO: Encriptar properly
          isActive: true,
        },
      });
    }

    // Marcar onboarding como completado
    await prisma.tenant.update({
      where: { id: user.tenant.id },
      data: { onboardingCompletedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: "Credenciales MT5 guardadas correctamente",
    });
  } catch (error) {
    console.error("Error guardando credenciales MT5:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
