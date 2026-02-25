/**
 * API de Configuración para el Bot
 * ================================
 *
 * GET: Obtiene la configuración actual
 * PUT: Actualiza la configuración
 */
import { NextRequest, NextResponse } from "next/server";
import { withBotAuth, validatePlanLimit } from "@/lib/security";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/bot/config
 * Obtiene la configuración actual del bot
 *
 * Headers: Authorization: Bearer <apiKey>
 */
export const GET = withBotAuth(async (request, auth) => {
  try {
    const botConfig = await prisma.botConfig.findUnique({
      where: { id: auth.botConfigId },
      include: {
        tenant: true,
      },
    });

    if (!botConfig) {
      return NextResponse.json(
        { success: false, error: "Configuración no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      config: {
        // Configuración de trading
        lotSize: botConfig.lotSize,
        gridDistance: botConfig.gridDistance,
        takeProfit: botConfig.takeProfit,
        maxLevels: auth.planLimits.maxLevels ?? botConfig.maxLevels,
        maxPositions: auth.planLimits.maxPositions ?? 1,

        // Trailing SL
        trailingActivate: botConfig.trailingActivate,
        trailingStep: botConfig.trailingStep,
        trailingBack: botConfig.trailingBack,

        // Restricciones
        defaultRestriction: botConfig.defaultRestriction,

        // Features del plan
        hasTrailingSL: auth.planLimits.hasTrailingSL ?? true,

        // Estado
        isActive: botConfig.isActive,
        lastUpdated: botConfig.updatedAt.toISOString(),
      },
      plan: auth.planLimits.planName
        ? {
            name: auth.planLimits.planName,
          }
        : null,
    });
  } catch (error) {
    console.error("Error obteniendo config:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/bot/config
 * Actualiza la configuración del bot
 *
 * Headers: Authorization: Bearer <apiKey>
 * Body: Partial<BotConfig>
 */
export const PUT = withBotAuth(async (request, auth) => {
  try {
    const data = await request.json();

    // Validar límites del plan para maxLevels
    if (data.maxLevels !== undefined) {
      const limitCheck = validatePlanLimit(auth, "maxLevels", data.maxLevels);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          { success: false, error: limitCheck.reason },
          { status: 400 }
        );
      }
    }

    // Actualizar solo campos permitidos
    const updateData: Record<string, unknown> = {};

    if (data.lotSize !== undefined) updateData.lotSize = data.lotSize;
    if (data.gridDistance !== undefined) updateData.gridDistance = data.gridDistance;
    if (data.takeProfit !== undefined) updateData.takeProfit = data.takeProfit;
    if (data.maxLevels !== undefined) {
      const maxAllowed = auth.planLimits.maxLevels ?? 3;
      updateData.maxLevels = Math.min(data.maxLevels, maxAllowed);
    }
    if (data.trailingActivate !== undefined) updateData.trailingActivate = data.trailingActivate;
    if (data.trailingStep !== undefined) updateData.trailingStep = data.trailingStep;
    if (data.trailingBack !== undefined) updateData.trailingBack = data.trailingBack;
    if (data.defaultRestriction !== undefined) updateData.defaultRestriction = data.defaultRestriction;

    const updated = await prisma.botConfig.update({
      where: { id: auth.botConfigId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      config: {
        lotSize: updated.lotSize,
        gridDistance: updated.gridDistance,
        takeProfit: updated.takeProfit,
        maxLevels: updated.maxLevels,
        trailingActivate: updated.trailingActivate,
        trailingStep: updated.trailingStep,
        trailingBack: updated.trailingBack,
        defaultRestriction: updated.defaultRestriction,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error actualizando config:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
});
