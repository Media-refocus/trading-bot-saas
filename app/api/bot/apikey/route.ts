/**
 * API Key Management para el Dashboard
 * ====================================
 *
 * Estos endpoints usan autenticación de sesión (no API key del bot)
 * porque son para que el usuario gestione sus keys desde el dashboard.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createApiKeyForTenant,
  revokeApiKey,
  clearPlainApiKey,
  logAuditEvent,
} from "@/lib/security";

/**
 * GET /api/bot/apikey
 * Obtiene el estado de la API key del usuario autenticado
 * (no devuelve la key completa por seguridad)
 */
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
          include: {
            botConfigs: true,
            plan: true,
            subscriptions: {
              where: { status: "ACTIVE" },
              take: 1,
            },
          },
        },
      },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    const botConfig = user.tenant.botConfigs[0];
    const activeSubscription = user.tenant.subscriptions[0];

    return NextResponse.json({
      success: true,
      hasApiKey: !!botConfig,
      apiKeyStatus: botConfig?.apiKeyStatus ?? null,
      isActive: botConfig?.isActive ?? false,
      lastHeartbeat: botConfig?.lastHeartbeat?.toISOString(),
      apiKeyCreatedAt: botConfig?.apiKeyCreatedAt?.toISOString(),
      apiKeyExpiresAt: botConfig?.apiKeyExpiresAt?.toISOString(),
      hasActiveSubscription: !!activeSubscription,
      plan: user.tenant.plan
        ? {
            name: user.tenant.plan.name,
            maxLevels: user.tenant.plan.maxLevels,
            maxPositions: user.tenant.plan.maxPositions,
          }
        : null,
    });
  } catch (error) {
    console.error("Error obteniendo API key:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bot/apikey
 * Genera una nueva API key para el usuario autenticado
 *
 * IMPORTANTE: La API key en texto plano solo se devuelve UNA vez
 */
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
          include: { plan: true },
        },
      },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    // Usar la función segura de creación de API key
    const result = await createApiKeyForTenant(user.tenantId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Error generando API key" },
        { status: 500 }
      );
    }

    const plan = user.tenant.plan;

    // IMPORTANTE: Devolver la API key en texto plano SOLO una vez
    // No se puede recuperar después
    return NextResponse.json({
      success: true,
      apiKey: result.apiKey,
      warning:
        "GUARDA ESTA API KEY EN UN LUGAR SEGURO. No se podrá volver a ver.",
      config: {
        maxLevels: plan?.maxLevels ?? 3,
        lotSize: 0.01,
        gridDistance: 10.0,
        takeProfit: 20.0,
      },
    });
  } catch (error) {
    console.error("Error generando API key:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bot/apikey
 * Revoca la API key actual
 */
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { tenant: true },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    // Revocar la API key usando la función segura
    const success = await revokeApiKey(user.tenantId, "USER_REQUEST");

    if (!success) {
      return NextResponse.json(
        { error: "No se pudo revocar la API key" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "API key revocada. El bot dejará de funcionar. Genera una nueva key si quieres reactivarlo.",
    });
  } catch (error) {
    console.error("Error revocando API key:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bot/apikey/rotate
 * Rota la API key (genera una nueva y revoca la anterior)
 *
 * Límite: 1 rotación por mes para evitar abuso
 */
export async function PUT() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        tenant: {
          include: {
            botConfigs: true,
            plan: true,
          },
        },
      },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    const botConfig = user.tenant.botConfigs[0];

    if (!botConfig) {
      return NextResponse.json(
        { error: "No existe API key para rotar" },
        { status: 400 }
      );
    }

    // Verificar límite de rotación (1 vez cada 30 días)
    if (botConfig.apiKeyRotatedAt) {
      const daysSinceRotation =
        (Date.now() - botConfig.apiKeyRotatedAt.getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysSinceRotation < 30) {
        return NextResponse.json(
          {
            error: `Solo puedes rotar la API key una vez cada 30 días. Espera ${Math.ceil(
              30 - daysSinceRotation
            )} días más.`,
          },
          { status: 429 }
        );
      }
    }

    // Usar la función segura de creación (actualiza la existente)
    const result = await createApiKeyForTenant(user.tenantId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Error rotando API key" },
        { status: 500 }
      );
    }

    const plan = user.tenant.plan;

    return NextResponse.json({
      success: true,
      apiKey: result.apiKey,
      warning:
        "GUARDA ESTA NUEVA API KEY. La anterior ya no funciona. Actualiza tu bot inmediatamente.",
      config: {
        maxLevels: plan?.maxLevels ?? 3,
      },
    });
  } catch (error) {
    console.error("Error rotando API key:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
