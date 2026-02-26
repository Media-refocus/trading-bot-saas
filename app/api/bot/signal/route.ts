/**
 * POST /api/bot/signal
 *
 * Endpoint que el bot llama cuando detecta una señal de Telegram.
 * Registra la señal en DB y retorna si debe ejecutarla o no.
 */

import { NextRequest } from "next/server";
import {
  authenticateBot,
  botErrorResponse,
  botSuccessResponse,
} from "../auth";
import { prisma } from "@/lib/prisma";

interface SignalRequest {
  // Datos de la señal
  side: "BUY" | "SELL";
  symbol: string;
  price?: number;

  // Origen
  messageText: string;
  channelId?: string;
  channelName?: string;
  messageId?: string;

  // Tipo especial
  isCloseSignal?: boolean;

  // Timestamp
  receivedAt?: string;
}

export async function POST(request: NextRequest) {
  // Autenticar bot
  const auth = await authenticateBot(request);
  if (!auth.success) {
    return auth.error;
  }

  const { botConfig } = auth;

  // Parsear body
  let body: SignalRequest;
  try {
    body = await request.json();
  } catch {
    return botErrorResponse("Invalid JSON body", 400, "INVALID_BODY");
  }

  // Validar campos requeridos
  if (!body.side || !body.symbol) {
    return botErrorResponse(
      "Missing required fields: side, symbol",
      400,
      "MISSING_FIELDS"
    );
  }

  if (!["BUY", "SELL"].includes(body.side)) {
    return botErrorResponse(
      "Invalid side. Must be BUY or SELL",
      400,
      "INVALID_SIDE"
    );
  }

  // Verificar si el bot está pausado
  if (botConfig.status === "PAUSED") {
    // Aún registramos la señal pero con status SKIPPED
    const signal = await prisma.signal.create({
      data: {
        tenantId: botConfig.tenantId,
        botConfigId: botConfig.id,
        side: body.side,
        symbol: body.symbol,
        price: body.price,
        messageText: body.messageText,
        channelId: body.channelId,
        channelName: body.channelName,
        messageId: body.messageId,
        isCloseSignal: body.isCloseSignal ?? false,
        receivedAt: body.receivedAt ? new Date(body.receivedAt) : new Date(),
        status: "CANCELLED",
        errorMessage: "Bot is paused",
      },
    });

    return botSuccessResponse({
      signalId: signal.id,
      action: "SKIP",
      reason: "Bot is paused",
    });
  }

  // Determinar acción basada en si es señal de cierre o no
  let action: "EXECUTE" | "SKIP" = "EXECUTE";

  if (body.isCloseSignal) {
    // Señal de cierre ("cerramos rango") - siempre ejecutar
    action = "EXECUTE";
  } else {
    // Señal normal de BUY/SELL
    // Aquí podríamos añadir lógica de filtros:
    // - Horario de trading
    // - Máximo de posiciones abiertas
    // - etc.

    // Por ahora, siempre ejecutar
    action = "EXECUTE";
  }

  // Crear señal en DB
  const signal = await prisma.signal.create({
    data: {
      tenantId: botConfig.tenantId,
      botConfigId: botConfig.id,
      side: body.side,
      symbol: body.symbol,
      price: body.price,
      messageText: body.messageText,
      channelId: body.channelId,
      channelName: body.channelName,
      messageId: body.messageId,
      isCloseSignal: body.isCloseSignal ?? false,
      receivedAt: body.receivedAt ? new Date(body.receivedAt) : new Date(),
      status: action === "EXECUTE" ? "PROCESSING" : "CANCELLED",
    },
  });

  return botSuccessResponse({
    signalId: signal.id,
    action,
  });
}
