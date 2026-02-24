import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * POST /api/signals/ingest
 *
 * Recibe una señal del ingestor de Telegram y la distribuye a todos los tenants activos.
 *
 * Request body:
 * {
 *   type: "ENTRY" | "CLOSE_RANGE" | "SL_MODIFY" | "TP_MODIFY",
 *   side?: "BUY" | "SELL",
 *   price?: number,
 *   symbol?: string,
 *   restriction?: string,
 *   messageText: string,
 *   telegramMsgId?: number
 * }
 *
 * Headers:
 *   Authorization: Bearer <admin_api_key>  // Opcional, para verificación
 */
export async function POST(request: Request) {
  try {
    const data = await request.json();

    // Validar campos requeridos
    if (!data.type || !data.messageText) {
      return NextResponse.json(
        { success: false, error: "type y messageText son requeridos" },
        { status: 400 }
      );
    }

    // Validar tipo de señal
    const validTypes = ["ENTRY", "CLOSE_RANGE", "SL_MODIFY", "TP_MODIFY"];
    if (!validTypes.includes(data.type)) {
      return NextResponse.json(
        { success: false, error: `Tipo de señal inválido. Válidos: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Validar side para ENTRY
    if (data.type === "ENTRY") {
      if (!data.side || !["BUY", "SELL"].includes(data.side)) {
        return NextResponse.json(
          { success: false, error: "ENTRY requiere side: BUY o SELL" },
          { status: 400 }
        );
      }
    }

    // Crear la señal global
    const globalSignal = await prisma.globalSignal.create({
      data: {
        type: data.type,
        side: data.side || null,
        price: data.price || null,
        symbol: data.symbol || "XAUUSD",
        restriction: data.restriction || null,
        messageText: data.messageText,
        telegramMsgId: data.telegramMsgId || null,
      },
    });

    // Obtener todos los tenants activos con bots activos
    const activeBotConfigs = await prisma.botConfig.findMany({
      where: {
        isActive: true,
        tenant: {
          subscriptions: {
            some: {
              status: "ACTIVE",
            },
          },
        },
      },
      include: {
        tenant: true,
      },
    });

    // Crear entregas para cada tenant activo
    const deliveries = await Promise.all(
      activeBotConfigs.map((botConfig) =>
        prisma.signalDelivery.create({
          data: {
            globalSignalId: globalSignal.id,
            tenantId: botConfig.tenantId,
            status: "PENDING",
          },
        })
      )
    );

    // Marcar señal como distribuida
    await prisma.globalSignal.update({
      where: { id: globalSignal.id },
      data: { distributedAt: new Date() },
    });

    // Log
    console.log(
      `[INGEST] Signal ${globalSignal.type} ${data.side || ""} -> ${deliveries.length} tenants`
    );

    return NextResponse.json({
      success: true,
      signalId: globalSignal.id,
      type: globalSignal.type,
      side: globalSignal.side,
      deliveredTo: deliveries.length,
      tenants: activeBotConfigs.map((b) => ({
        id: b.tenantId,
        name: b.tenant.name,
      })),
    });
  } catch (error) {
    console.error("Error ingiriendo señal:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/signals/ingest
 *
 * Obtiene las últimas señales recibidas (para debugging/monitoreo)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const type = searchParams.get("type");

    const signals = await prisma.globalSignal.findMany({
      where: type ? { type } : undefined,
      take: limit,
      orderBy: { receivedAt: "desc" },
      include: {
        deliveries: {
          select: {
            tenantId: true,
            status: true,
            deliveredAt: true,
            executedAt: true,
          },
        },
        _count: {
          select: { deliveries: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      count: signals.length,
      signals: signals.map((s) => ({
        id: s.id,
        type: s.type,
        side: s.side,
        price: s.price,
        symbol: s.symbol,
        restriction: s.restriction,
        messageText: s.messageText.substring(0, 100),
        receivedAt: s.receivedAt.toISOString(),
        distributedAt: s.distributedAt?.toISOString(),
        deliveryCount: s._count.deliveries,
        deliveries: s.deliveries,
      })),
    });
  } catch (error) {
    console.error("Error obteniendo señales:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
