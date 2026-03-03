/**
 * GET /api/backtest/export/[id]
 * Exporta resultados de backtest como CSV o PDF
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
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv"; // csv o pdf

    // Buscar backtest completo
    const backtest = await prisma.backtest.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        SimulatedTrade: {
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

    if (backtest.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "El backtest no está completado" },
        { status: 400 }
      );
    }

    // Obtener tradeDetails del JSON
    const results = backtest.results as any;
    const tradeDetails = results?.tradeDetails || [];

    if (format === "csv") {
      // Generar CSV
      const headers = [
        "Signal Index",
        "Signal Time",
        "Side",
        "Signal Price",
        "Entry Price",
        "Exit Price",
        "Entry Time",
        "Exit Time",
        "Exit Reason",
        "Total Lots",
        "Avg Price",
        "Total Profit ($)",
        "Total Pips",
        "Duration (min)",
        "Levels",
      ];

      const rows = tradeDetails.map((t: any) => [
        t.signalIndex,
        t.signalTimestamp,
        t.signalSide,
        t.signalPrice?.toFixed(2),
        t.entryPrice?.toFixed(2),
        t.exitPrice?.toFixed(2),
        t.entryTime,
        t.exitTime,
        t.exitReason,
        t.totalLots?.toFixed(2),
        t.avgPrice?.toFixed(2),
        t.totalProfit?.toFixed(2),
        t.totalProfitPips?.toFixed(1),
        t.durationMinutes?.toFixed(0),
        t.maxLevels,
      ]);

      // Resumen al final
      const summaryRows = [
        [],
        ["=== RESUMEN ==="],
        ["Total Trades", backtest.totalTrades],
        ["Win Rate", `${backtest.winRate.toFixed(2)}%`],
        ["Total Profit", `$${backtest.totalProfit.toFixed(2)}`],
        ["Total Pips", backtest.totalProfitPips.toFixed(1)],
        ["Profit Factor", backtest.profitFactor.toFixed(2)],
        ["Max Drawdown", `$${backtest.maxDrawdown.toFixed(2)}`],
        ["Sharpe Ratio", backtest.sharpeRatio.toFixed(2)],
        ["Sortino Ratio", backtest.sortinoRatio.toFixed(2)],
        ["Calmar Ratio", backtest.calmarRatio.toFixed(2)],
        ["Initial Capital", `$${backtest.initialCapital.toFixed(2)}`],
        ["Final Capital", `$${backtest.finalCapital.toFixed(2)}`],
        ["Return %", `${backtest.profitPercent.toFixed(2)}%`],
      ];

      const csvContent = [
        headers.join(","),
        ...rows.map((r: any[]) => r.join(",")),
        ...summaryRows.map((r) => r.join(",")),
      ].join("\n");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="backtest_${backtest.id}.csv"`,
        },
      });
    }

    if (format === "pdf") {
      // Para PDF, devolver datos estructurados que el frontend puede usar
      // La generación de PDF real se hace en el cliente con librerías como jspdf
      return NextResponse.json({
        backtest: {
          id: backtest.id,
          name: backtest.name,
          strategyName: backtest.strategyName,
          createdAt: backtest.createdAt,
          completedAt: backtest.completedAt,
          // Métricas
          totalTrades: backtest.totalTrades,
          winRate: backtest.winRate,
          totalProfit: backtest.totalProfit,
          profitFactor: backtest.profitFactor,
          sharpeRatio: backtest.sharpeRatio,
          maxDrawdown: backtest.maxDrawdown,
          initialCapital: backtest.initialCapital,
          finalCapital: backtest.finalCapital,
          profitPercent: backtest.profitPercent,
        },
        tradeDetails,
        equityCurve: results?.equityCurve || [],
        segmentation: backtest.segmentation,
        parameters: backtest.parameters,
      });
    }

    return NextResponse.json(
      { error: "Formato no soportado. Use 'csv' o 'pdf'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[API /backtest/export/[id]] Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
