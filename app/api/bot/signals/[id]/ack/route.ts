/**
 * POST /api/bot/signals/[id]/ack
 *
 * Confirma que el bot ha procesado una señal.
 * Actualiza el estado de la señal y registra el resultado.
 */

import { NextRequest } from "next/server";
import {
  authenticateBot,
  botErrorResponse,
  botSuccessResponse,
} from "../../../auth";
import { prisma } from "@/lib/prisma";

interface AckRequest {
  status: "EXECUTED" | "FAILED" | "REJECTED" | "SKIPPED";
  error?: string;
  mt5_ticket?: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Autenticar bot
  const auth = await authenticateBot(request);
  if (!auth.success) {
    return auth.error;
  }

  const { botConfig } = auth;
  const { id: signalId } = await params;

  // Parsear body
  let body: AckRequest;
  try {
    body = await request.json();
  } catch {
    return botErrorResponse("Invalid JSON body", 400, "INVALID_BODY");
  }

  // Validar status
  const validStatuses = ["EXECUTED", "FAILED", "REJECTED", "SKIPPED"];
  if (!body.status || !validStatuses.includes(body.status)) {
    return botErrorResponse(
      `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      400,
      "INVALID_STATUS"
    );
  }

  // Verificar que la señal existe y pertenece al tenant
  const signal = await prisma.signal.findFirst({
    where: {
      id: signalId,
      tenantId: botConfig.tenantId,
    },
  });

  if (!signal) {
    return botErrorResponse("Signal not found", 404, "SIGNAL_NOT_FOUND");
  }

  // Actualizar señal
  const updatedSignal = await prisma.signal.update({
    where: { id: signalId },
    data: {
      status: body.status,
      processedAt: new Date(),
      errorMessage: body.error,
    },
  });

  // Si se ejecutó y hay ticket de MT5, crear registro de trade
  if (body.status === "EXECUTED" && body.mt5_ticket) {
    await prisma.trade.create({
      data: {
        tenantId: botConfig.tenantId,
        botConfigId: botConfig.id,
        signalId: signalId,
        mt5Ticket: body.mt5_ticket,
        side: signal.side,
        symbol: signal.symbol,
        level: 0,
        openPrice: signal.price ?? 0,
        lotSize: 0, // El bot actualizará después
        status: "OPEN",
      },
    });
  }

  return botSuccessResponse({
    signal_id: signalId,
    status: updatedSignal.status,
    processed_at: updatedSignal.processedAt?.toISOString(),
  });
}
