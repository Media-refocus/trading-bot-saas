/**
 * POST /api/backtest/[id]/cancel
 * Cancela un backtest en ejecución
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { cancelJob } from "@/lib/backtest-jobs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticación
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json(
        { error: "Usuario sin tenant" },
        { status: 400 }
      );
    }

    const { id } = await params;

    // Buscar backtest
    const backtest = await prisma.backtest.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!backtest) {
      return NextResponse.json(
        { error: "Backtest no encontrado" },
        { status: 404 }
      );
    }

    // Verificar que se puede cancelar
    if (backtest.status !== "PENDING" && backtest.status !== "RUNNING") {
      return NextResponse.json(
        { error: "El backtest no se puede cancelar en su estado actual" },
        { status: 400 }
      );
    }

    // Intentar cancelar job en memoria si existe
    cancelJob(id);

    // Actualizar estado en BD
    const updated = await prisma.backtest.update({
      where: { id },
      data: {
        status: "CANCELLED",
        error: "Cancelado por el usuario",
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      status: updated.status,
      message: "Backtest cancelado",
    });
  } catch (error) {
    console.error("[API /backtest/[id]/cancel] Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
