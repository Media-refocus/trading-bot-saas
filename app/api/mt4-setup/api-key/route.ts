/**
 * API MT4 Setup - API Key Management
 * ====================================
 *
 * GET: Obtiene la API Key actual del usuario
 * POST: Genera una nueva API Key
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

function generateApiKey(): string {
  // Generar API key en formato: bot_xxxxxxxxxxxxxxxx
  return "bot_" + randomBytes(16).toString("hex");
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        tenant: {
          include: { botConfigs: true },
        },
      },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    // Si ya tiene BotConfig, devolver la API key
    const botConfig = user.tenant.botConfigs?.[0];
    if (botConfig) {
      return NextResponse.json({
        success: true,
        apiKey: botConfig.apiKeyPlain,
        status: botConfig.apiKeyStatus,
        createdAt: botConfig.apiKeyCreatedAt,
        lastUsed: botConfig.lastHeartbeat,
      });
    }

    // No tiene API key aún
    return NextResponse.json({
      success: false,
      error: "No API key",
    });
  } catch (error) {
    console.error("Error obteniendo API key:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        tenant: {
          include: { botConfigs: true },
        },
      },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    const newApiKey = generateApiKey();
    const existingConfig = user.tenant.botConfigs?.[0];

    // Si ya tiene BotConfig, actualizar
    if (existingConfig) {
      const updated = await prisma.botConfig.update({
        where: { id: existingConfig.id },
        data: {
          apiKeyPlain: newApiKey,
          apiKeyStatus: "ACTIVE",
          apiKeyRotatedAt: new Date(),
        },
      });

      // Log de auditoría
      await prisma.apiKeyAudit.create({
        data: {
          botConfigId: updated.id,
          event: "API_KEY_ROTATED",
          metadata: { rotatedAt: new Date().toISOString() },
        },
      });

      return NextResponse.json({
        success: true,
        apiKey: newApiKey,
        status: "ACTIVE",
        createdAt: updated.apiKeyCreatedAt,
        lastUsed: null,
      });
    }

    // Crear nuevo BotConfig
    const newConfig = await prisma.botConfig.create({
      data: {
        tenantId: user.tenant.id,
        apiKeyPlain: newApiKey,
        apiKey: newApiKey, // En producción, esto debería ser un hash
        apiKeyStatus: "ACTIVE",
        apiKeyCreatedAt: new Date(),
      },
    });

    // Log de auditoría
    await prisma.apiKeyAudit.create({
      data: {
        botConfigId: newConfig.id,
        event: "API_KEY_GENERATED",
        metadata: { generatedAt: new Date().toISOString() },
      },
    });

    return NextResponse.json({
      success: true,
      apiKey: newApiKey,
      status: "ACTIVE",
      createdAt: newConfig.apiKeyCreatedAt,
      lastUsed: null,
    });
  } catch (error) {
    console.error("Error generando API key:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
