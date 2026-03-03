/**
 * POST /api/backtest/create
 * Crea un nuevo job de backtest y lo persiste en BD
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Schema de validación para crear backtest
const CreateBacktestSchema = z.object({
  name: z.string().optional(),
  strategyName: z.string().default("Toni (G4)"),
  parameters: z.object({
    lotajeBase: z.number().min(0.01).max(10).default(0.1),
    numOrders: z.number().min(1).max(5).default(1),
    pipsDistance: z.number().min(1).max(100).default(10),
    maxLevels: z.number().min(1).max(40).default(4),
    takeProfitPips: z.number().min(5).max(100).default(20),
    stopLossPips: z.number().min(0).max(500).optional(),
    useStopLoss: z.boolean().default(false),
    useTrailingSL: z.boolean().optional().default(true),
    trailingSLPercent: z.number().min(10).max(90).optional().default(50),
    restrictionType: z.enum(["RIESGO", "SIN_PROMEDIOS", "SOLO_1_PROMEDIO"]).optional(),
    signalsSource: z.string().optional().default("signals_simple.csv"),
    useRealPrices: z.boolean().optional().default(true),
    initialCapital: z.number().min(100).max(10000000).optional().default(10000),
    filters: z.object({
      dateFrom: z.coerce.date().optional(),
      dateTo: z.coerce.date().optional(),
      daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
      hourFrom: z.number().min(0).max(23).optional(),
      hourTo: z.number().min(0).max(24).optional(),
      session: z.enum(["ASIAN", "EUROPEAN", "US", "ALL"]).optional(),
      side: z.enum(["BUY", "SELL"]).optional(),
    }).optional(),
  }),
});

export async function POST(request: NextRequest) {
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

    // Parsear y validar input
    const body = await request.json();
    const validated = CreateBacktestSchema.parse(body);

    // Crear backtest en BD
    const backtest = await prisma.backtest.create({
      data: {
        tenantId: user.tenantId,
        name: validated.name || `Backtest ${new Date().toISOString()}`,
        strategyName: validated.strategyName,
        parameters: validated.parameters,
        status: "PENDING",
        initialCapital: validated.parameters.initialCapital || 10000,
      },
    });

    return NextResponse.json({
      id: backtest.id,
      status: backtest.status,
      message: "Backtest creado exitosamente",
    });
  } catch (error) {
    console.error("[API /backtest/create] Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
