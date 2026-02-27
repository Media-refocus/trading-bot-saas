/**
 * GET /api/bot/signals/pending
 *
 * Endpoint para que el bot obtenga las señales pendientes de procesar.
 * Las señales se crean cuando el sistema detecta mensajes en canales de Telegram
 * y se marcan como procesadas cuando el bot las confirma.
 */

import { NextRequest } from "next/server";
import {
  authenticateBot,
  botErrorResponse,
  botSuccessResponse,
} from "../../auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  // Autenticar bot
  const auth = await authenticateBot(request);
  if (!auth.success) {
    return auth.error;
  }

  const { botConfig } = auth;

  // Obtener señales pendientes
  // Una señal está pendiente si:
  // - status = "PENDING"
  // - pertenece al tenant del bot
  // - no ha sido procesada aún
  const pendingSignals = await prisma.signal.findMany({
    where: {
      tenantId: botConfig.tenantId,
      status: "PENDING",
      // Opcional: solo señales de los últimos 30 minutos
      receivedAt: {
        gte: new Date(Date.now() - 30 * 60 * 1000),
      },
    },
    orderBy: {
      receivedAt: "asc",
    },
    take: 10, // Máximo 10 señales por request
  });

  // Formatear respuesta
  const signals = pendingSignals.map((signal) => ({
    id: signal.id,
    type: signal.isCloseSignal ? "CLOSE" : "ENTRY",
    side: signal.side,
    price: signal.price,
    symbol: signal.symbol,
    restriction_type: signal.restrictionType,
    max_levels: signal.maxLevels,
    channel_name: signal.channelName,
    message_text: signal.messageText,
    timestamp: signal.receivedAt.toISOString(),
  }));

  return botSuccessResponse({
    signals,
    count: signals.length,
  });
}
