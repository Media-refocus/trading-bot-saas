/**
 * GET /api/backtest/[id]
 * Obtiene el estado y resultados de un backtest
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(
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

    // Obtener usuario para tenantId
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
      where: {
        id,
        tenantId: user.tenantId, // Asegurar que es del tenant correcto
      },
      include: {
        SimulatedTrade: {
          take: 100, // Limitar trades para no sobrecargar
          orderBy: { timestamp: "asc" },
        },
      },
    });

    if (!backtest) {
      return NextResponse.json(
        { error: "Backtest no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: backtest.id,
      name: backtest.name,
      strategyName: backtest.strategyName,
      status: backtest.status,
      parameters: backtest.parameters,
      // Métricas básicas
      totalTrades: backtest.totalTrades,
      totalProfit: backtest.totalProfit,
      totalProfitPips: backtest.totalProfitPips,
      winRate: backtest.winRate,
      maxDrawdown: backtest.maxDrawdown,
      profitFactor: backtest.profitFactor,
      // Capital
      initialCapital: backtest.initialCapital,
      finalCapital: backtest.finalCapital,
      profitPercent: backtest.profitPercent,
      maxDrawdownPercent: backtest.maxDrawdownPercent,
      // Métricas avanzadas
      sharpeRatio: backtest.sharpeRatio,
      sortinoRatio: backtest.sortinoRatio,
      calmarRatio: backtest.calmarRatio,
      expectancy: backtest.expectancy,
      avgWin: backtest.avgWin,
      avgLoss: backtest.avgLoss,
      rewardRiskRatio: backtest.rewardRiskRatio,
      maxConsecutiveWins: backtest.maxConsecutiveWins,
      maxConsecutiveLosses: backtest.maxConsecutiveLosses,
      profitFactorByMonth: backtest.profitFactorByMonth,
      // Segmentación y detalles
      segmentation: backtest.segmentation,
      results: backtest.results,
      // Control
      startedAt: backtest.startedAt,
      completedAt: backtest.completedAt,
      error: backtest.error,
      ticksProcessed: backtest.ticksProcessed,
      totalTicks: backtest.totalTicks,
      createdAt: backtest.createdAt,
      updatedAt: backtest.updatedAt,
      // Trades simulados (muestra)
      trades: backtest.SimulatedTrade,
    });
  } catch (error) {
    console.error("[API /backtest/[id]] Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/backtest/[id]
 * Elimina un backtest
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // Verificar ownership antes de eliminar
    const backtest = await prisma.backtest.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true },
    });

    if (!backtest) {
      return NextResponse.json(
        { error: "Backtest no encontrado" },
        { status: 404 }
      );
    }

    // Eliminar (cascade elimina SimulatedTrade automáticamente)
    await prisma.backtest.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Backtest eliminado",
    });
  } catch (error) {
    console.error("[API /backtest/[id] DELETE] Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
