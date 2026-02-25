/**
 * API de Planes
 * =============
 *
 * GET: Lista planes disponibles y el plan actual del usuario
 * POST: Asigna un plan al tenant (para testing/admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlanInfo } from "@/lib/plans";

/**
 * Genera la lista de features para mostrar en la UI
 */
function generateFeatures(plan: {
  maxPositions: number;
  maxLevels: number;
  maxBacktestsMonth: number;
  hasTrailingSL: boolean;
  hasAdvancedGrid: boolean;
  hasOptimizador: boolean;
  hasBacktestsIlimitados: boolean;
  hasPaperTrading: boolean;
  hasMetricsDashboard: boolean;
  hasMultiCuenta: boolean;
  hasApiAccess: boolean;
  hasVpsDedicado: boolean;
  hasPriority: boolean;
  hasSoporte247: boolean;
}): string[] {
  const features: string[] = [];

  // Límites básicos
  features.push(`${plan.maxPositions} posicion${plan.maxPositions > 1 ? "es" : ""} simultanea${plan.maxPositions > 1 ? "s" : ""}`);
  features.push(`${plan.maxLevels} nivel${plan.maxLevels > 1 ? "es" : ""} de promedio`);

  // Backtests
  if (plan.hasBacktestsIlimitados || plan.maxBacktestsMonth === 0) {
    features.push("Backtests ilimitados");
  } else {
    features.push(`${plan.maxBacktestsMonth} backtests/mes`);
  }

  // Paper trading (todos los planes)
  if (plan.hasPaperTrading) {
    features.push("Paper Trading");
  }

  // Features de Trader+
  if (plan.hasTrailingSL) {
    features.push("Trailing Stop Loss");
  }
  if (plan.hasAdvancedGrid) {
    features.push("Grid Avanzado");
  }

  // Features de Pro+
  if (plan.hasOptimizador) {
    features.push("Optimizador automatico");
  }
  if (plan.hasMetricsDashboard) {
    features.push("Dashboard metricas avanzado");
  }
  if (plan.hasPriority) {
    features.push("Soporte prioritario");
  }

  // Features Enterprise
  if (plan.hasMultiCuenta) {
    features.push("Multi-cuenta MT5");
  }
  if (plan.hasApiAccess) {
    features.push("API Access");
  }
  if (plan.hasVpsDedicado) {
    features.push("VPS dedicado incluido");
  }
  if (plan.hasSoporte247) {
    features.push("Soporte 24/7");
  }

  return features;
}

/**
 * GET /api/plans
 * Lista planes disponibles y el plan actual del usuario
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { tenant: true },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    const planInfo = await getPlanInfo(user.tenant.id);

    return NextResponse.json({
      success: true,
      currentPlan: {
        name: planInfo.current.planName,
        id: planInfo.current.planId,
        limits: {
          maxPositions: planInfo.current.maxPositions,
          maxLevels: planInfo.current.maxLevels,
          hasTrailingSL: planInfo.current.hasTrailingSL,
          hasAdvancedGrid: planInfo.current.hasAdvancedGrid,
          hasOptimizador: planInfo.current.hasOptimizador,
          hasBacktestsIlimitados: planInfo.current.hasBacktestsIlimitados,
          hasMetricsDashboard: planInfo.current.hasMetricsDashboard,
          hasMultiCuenta: planInfo.current.hasMultiCuenta,
          hasApiAccess: planInfo.current.hasApiAccess,
          hasVpsDedicado: planInfo.current.hasVpsDedicado,
          hasPriority: planInfo.current.hasPriority,
          hasSoporte247: planInfo.current.hasSoporte247,
        },
        implementationFeePaid: user.tenant.implementationFeePaid,
      },
      availablePlans: planInfo.plans.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        currency: p.currency,
        implementationFee: p.implementationFee,
        features: generateFeatures(p),
      })),
    });
  } catch (error) {
    console.error("Error obteniendo planes:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/plans
 * Asigna un plan al tenant (para testing/demos)
 * En produccion, esto se haria via Stripe webhook
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { planId } = body;

    if (!planId) {
      return NextResponse.json({ error: "planId es requerido" }, { status: 400 });
    }

    // Verificar que el plan existe
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { tenant: true },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    // Si el plan no tiene fee de implementación, marcar como pagado automáticamente
    const implementationFeePaid = plan.implementationFee === null;

    // Asignar plan al tenant
    const updatedTenant = await prisma.tenant.update({
      where: { id: user.tenant.id },
      data: {
        planId,
        implementationFeePaid,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Plan ${plan.name} asignado correctamente`,
      plan: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
        implementationFee: plan.implementationFee,
      },
      needsImplementationFee: !implementationFeePaid && plan.implementationFee !== null,
    });
  } catch (error) {
    console.error("Error asignando plan:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
