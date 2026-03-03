/**
 * GET /api/backtest/results
 * Lista backtests paginados del usuario
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
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

    // Parámetros de paginación
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const status = searchParams.get("status"); // PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Construir query
    const where: any = { tenantId: user.tenantId };
    if (status) {
      where.status = status;
    }

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    // Ejecutar consultas en paralelo
    const [backtests, total] = await Promise.all([
      prisma.backtest.findMany({
        where,
        select: {
          id: true,
          name: true,
          strategyName: true,
          status: true,
          totalTrades: true,
          totalProfit: true,
          winRate: true,
          profitFactor: true,
          sharpeRatio: true,
          maxDrawdown: true,
          profitPercent: true,
          createdAt: true,
          completedAt: true,
          startedAt: true,
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.backtest.count({ where }),
    ]);

    return NextResponse.json({
      data: backtests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[API /backtest/results] Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
