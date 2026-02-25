/**
 * API de Señales para el Bot
 * ==========================
 *
 * GET: Obtiene señales pendientes
 * POST: Marca señales como ejecutadas/fallidas
 */
import { NextRequest, NextResponse } from "next/server";
import { withBotAuth, authenticateBotRequest } from "@/lib/security";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/bot/signals
 * Obtiene señales pendientes para el bot autenticado
 *
 * Headers: Authorization: Bearer <apiKey>
 * Query: since?: ISO timestamp (opcional)
 */
export const GET = withBotAuth(async (request, auth) => {
  try {
    // Parsear parámetro "since"
    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since");

    // Obtener señales pendientes para este tenant
    const pendingDeliveries = await prisma.signalDelivery.findMany({
      where: {
        tenantId: auth.tenantId,
        status: "PENDING",
        ...(since && {
          globalSignal: {
            receivedAt: { gte: new Date(since) },
          },
        }),
      },
      include: {
        globalSignal: true,
      },
      orderBy: {
        globalSignal: {
          receivedAt: "asc",
        },
      },
      take: 50, // Máximo 50 señales por request
    });

    // Marcar como entregadas
    if (pendingDeliveries.length > 0) {
      await prisma.signalDelivery.updateMany({
        where: {
          id: { in: pendingDeliveries.map((d) => d.id) },
        },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
        },
      });
    }

    // Formatear señales para el bot
    const signals = pendingDeliveries.map((d) => ({
      id: d.globalSignal.id,
      type: d.globalSignal.type,
      side: d.globalSignal.side,
      price: d.globalSignal.price,
      symbol: d.globalSignal.symbol,
      restriction: d.globalSignal.restriction,
      messageText: d.globalSignal.messageText,
      receivedAt: d.globalSignal.receivedAt.toISOString(),
      deliveryId: d.id,
    }));

    return NextResponse.json({
      success: true,
      count: signals.length,
      signals,
    });
  } catch (error) {
    console.error("Error obteniendo señales:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
});

/**
 * POST /api/bot/signals
 * Marca una señal como ejecutada (o fallida)
 *
 * Headers: Authorization: Bearer <apiKey>
 * Body: { deliveryId: string, status: "EXECUTED" | "FAILED", error?: string }
 */
export const POST = withBotAuth(async (request, auth) => {
  try {
    const { deliveryId, status, error } = await request.json();

    if (!deliveryId || !["EXECUTED", "FAILED"].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: "deliveryId y status (EXECUTED|FAILED) requeridos",
        },
        { status: 400 }
      );
    }

    // Verificar que la delivery pertenece a este tenant
    const delivery = await prisma.signalDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery || delivery.tenantId !== auth.tenantId) {
      return NextResponse.json(
        { success: false, error: "Delivery no encontrada" },
        { status: 404 }
      );
    }

    // Actualizar estado de la entrega
    await prisma.signalDelivery.update({
      where: { id: deliveryId },
      data: {
        status,
        executedAt: new Date(),
        error: status === "FAILED" ? error : null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error actualizando señal:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
});
