/**
 * Sistema de Planes y Límites
 * ===========================
 *
 * Funciones para verificar y aplicar límites según el plan del tenant.
 * Planes: Starter (57€), Trader (97€), Pro (197€), Enterprise (497€)
 */

import { prisma } from "./prisma";

// Plan por defecto cuando un tenant no tiene plan asignado
const DEFAULT_PLAN_LIMITS = {
  maxPositions: 1,
  maxBrokers: 1,
  maxLevels: 2,
  maxBacktestsMonth: 0,
  hasTrailingSL: false,
  hasAdvancedGrid: false,
  hasOptimizador: false,
  hasBacktestsIlimitados: false,
  hasPaperTrading: true,
  hasMetricsDashboard: false,
  hasMultiCuenta: false,
  hasApiAccess: false,
  hasVpsDedicado: false,
  hasPriority: false,
  hasSoporte247: false,
  implementationFee: 97,
};

export interface PlanLimits {
  maxPositions: number;
  maxBrokers: number;
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
  implementationFee: number | null;
  planName: string;
  planId: string | null;
}

/**
 * Obtiene los límites del plan de un tenant
 */
export async function getTenantPlanLimits(tenantId: string): Promise<PlanLimits> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { plan: true },
  });

  if (!tenant) {
    throw new Error(`Tenant ${tenantId} no encontrado`);
  }

  // Si tiene plan asignado, usar sus límites
  if (tenant.plan) {
    return {
      maxPositions: tenant.plan.maxPositions,
      maxBrokers: tenant.plan.maxBrokers,
      maxLevels: tenant.plan.maxLevels,
      maxBacktestsMonth: tenant.plan.maxBacktestsMonth,
      hasTrailingSL: tenant.plan.hasTrailingSL,
      hasAdvancedGrid: tenant.plan.hasAdvancedGrid,
      hasOptimizador: tenant.plan.hasOptimizador,
      hasBacktestsIlimitados: tenant.plan.hasBacktestsIlimitados,
      hasPaperTrading: tenant.plan.hasPaperTrading,
      hasMetricsDashboard: tenant.plan.hasMetricsDashboard,
      hasMultiCuenta: tenant.plan.hasMultiCuenta,
      hasApiAccess: tenant.plan.hasApiAccess,
      hasVpsDedicado: tenant.plan.hasVpsDedicado,
      hasPriority: tenant.plan.hasPriority,
      hasSoporte247: tenant.plan.hasSoporte247,
      implementationFee: tenant.plan.implementationFee,
      planName: tenant.plan.name,
      planId: tenant.plan.id,
    };
  }

  // Sin plan asignado, usar límites por defecto (Free/Trial)
  return {
    ...DEFAULT_PLAN_LIMITS,
    planName: "Free",
    planId: null,
  };
}

/**
 * Verifica si un valor está dentro del límite del plan
 */
export function checkLimit(value: number, max: number): { allowed: boolean; remaining: number } {
  return {
    allowed: value < max,
    remaining: Math.max(0, max - value),
  };
}

/**
 * Verifica si el tenant puede abrir más posiciones
 */
export async function canOpenPosition(tenantId: string): Promise<{ allowed: boolean; reason?: string; remaining: number }> {
  const limits = await getTenantPlanLimits(tenantId);

  // Contar posiciones abiertas actuales
  const openPositions = await prisma.position.count({
    where: {
      tenantId,
      status: "OPEN",
    },
  });

  const check = checkLimit(openPositions, limits.maxPositions);

  if (!check.allowed) {
    return {
      allowed: false,
      reason: `Límite de posiciones alcanzado (${limits.maxPositions}). Haz upgrade a un plan superior.`,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    remaining: check.remaining,
  };
}

/**
 * Verifica si el tenant puede usar más niveles de promedio
 */
export async function canUseLevel(
  tenantId: string,
  requestedLevel: number
): Promise<{ allowed: boolean; reason?: string; maxLevels: number }> {
  const limits = await getTenantPlanLimits(tenantId);

  if (requestedLevel > limits.maxLevels) {
    return {
      allowed: false,
      reason: `Tu plan ${limits.planName} solo permite ${limits.maxLevels} niveles. Solicitado: ${requestedLevel}`,
      maxLevels: limits.maxLevels,
    };
  }

  return {
    allowed: true,
    maxLevels: limits.maxLevels,
  };
}

/**
 * Verifica si el tenant puede usar trailing SL
 */
export async function canUseTrailingSL(tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await getTenantPlanLimits(tenantId);

  if (!limits.hasTrailingSL) {
    return {
      allowed: false,
      reason: `Tu plan ${limits.planName} no incluye Trailing Stop Loss. Haz upgrade a Trader o superior.`,
    };
  }

  return { allowed: true };
}

/**
 * Verifica si el tenant puede usar grid avanzado
 */
export async function canUseAdvancedGrid(tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await getTenantPlanLimits(tenantId);

  if (!limits.hasAdvancedGrid) {
    return {
      allowed: false,
      reason: `Tu plan ${limits.planName} no incluye Grid Avanzado. Haz upgrade a Trader o superior.`,
    };
  }

  return { allowed: true };
}

/**
 * Verifica si el tenant puede usar el optimizador de parámetros
 */
export async function canUseOptimizador(tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await getTenantPlanLimits(tenantId);

  if (!limits.hasOptimizador) {
    return {
      allowed: false,
      reason: `Tu plan ${limits.planName} no incluye Optimizador de Parámetros. Haz upgrade a Pro o Enterprise.`,
    };
  }

  return { allowed: true };
}

/**
 * Verifica si el tenant puede hacer backtests (y cuántos le quedan)
 */
export async function canRunBacktest(tenantId: string): Promise<{ allowed: boolean; reason?: string; remaining: number }> {
  const limits = await getTenantPlanLimits(tenantId);

  // Si tiene backtests ilimitados
  if (limits.hasBacktestsIlimitados || limits.maxBacktestsMonth === 0) {
    return { allowed: true, remaining: Infinity };
  }

  // Contar backtests del mes actual
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const backtestsThisMonth = await prisma.backtest.count({
    where: {
      tenantId,
      createdAt: { gte: startOfMonth },
    },
  });

  const check = checkLimit(backtestsThisMonth, limits.maxBacktestsMonth);

  if (!check.allowed) {
    return {
      allowed: false,
      reason: `Límite de ${limits.maxBacktestsMonth} backtests/mes alcanzado. Haz upgrade a Pro para backtests ilimitados.`,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    remaining: check.remaining,
  };
}

/**
 * Verifica si el tenant puede usar multi-cuenta
 */
export async function canUseMultiCuenta(tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await getTenantPlanLimits(tenantId);

  if (!limits.hasMultiCuenta) {
    return {
      allowed: false,
      reason: `Tu plan ${limits.planName} no incluye Multi-Cuenta. Haz upgrade a Enterprise.`,
    };
  }

  return { allowed: true };
}

/**
 * Verifica si el tenant tiene acceso a la API
 */
export async function canUseApi(tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await getTenantPlanLimits(tenantId);

  if (!limits.hasApiAccess) {
    return {
      allowed: false,
      reason: `Tu plan ${limits.planName} no incluye acceso a la API. Haz upgrade a Enterprise.`,
    };
  }

  return { allowed: true };
}

/**
 * Verifica si el tenant necesita pagar fee de implementación
 */
export async function needsImplementationFee(tenantId: string): Promise<{ required: boolean; amount: number | null }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { plan: true },
  });

  if (!tenant || !tenant.plan) {
    return { required: true, amount: 97 };
  }

  // Si ya pagó
  if (tenant.implementationFeePaid) {
    return { required: false, amount: null };
  }

  // Si el plan tiene fee y no lo ha pagado
  if (tenant.plan.implementationFee) {
    return { required: true, amount: tenant.plan.implementationFee };
  }

  // Plan sin fee (incluido)
  return { required: false, amount: null };
}

/**
 * Marca el fee de implementación como pagado
 */
export async function markImplementationFeePaid(tenantId: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { implementationFeePaid: true },
  });
}

/**
 * Aplica límites a la configuración del bot
 * Modifica la configuración para que respete los límites del plan
 */
export async function applyPlanLimits(
  tenantId: string,
  config: {
    maxLevels?: number;
    trailingActivate?: number | null;
    trailingStep?: number | null;
    trailingBack?: number | null;
  }
): Promise<{
  config: typeof config;
  warnings: string[];
  limited: boolean;
}> {
  const limits = await getTenantPlanLimits(tenantId);
  const warnings: string[] = [];
  let limited = false;
  const result = { ...config };

  // Limitar maxLevels
  if (result.maxLevels && result.maxLevels > limits.maxLevels) {
    result.maxLevels = limits.maxLevels;
    warnings.push(`maxLevels limitado a ${limits.maxLevels} por tu plan ${limits.planName}`);
    limited = true;
  }

  // Deshabilitar trailing SL si no está permitido
  if (!limits.hasTrailingSL && (result.trailingActivate || result.trailingStep || result.trailingBack)) {
    result.trailingActivate = null;
    result.trailingStep = null;
    result.trailingBack = null;
    warnings.push(`Trailing SL deshabilitado por tu plan ${limits.planName}`);
    limited = true;
  }

  return { config: result, warnings, limited };
}

/**
 * Obtiene información del plan para mostrar en el dashboard
 */
export async function getPlanInfo(tenantId: string): Promise<{
  current: PlanLimits;
  plans: Array<{
    id: string;
    name: string;
    price: number;
    currency: string;
    implementationFee: number | null;
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
  }>;
}> {
  const [limits, plans] = await Promise.all([
    getTenantPlanLimits(tenantId),
    prisma.plan.findMany({
      orderBy: { price: "asc" },
      select: {
        id: true,
        name: true,
        price: true,
        currency: true,
        implementationFee: true,
        maxPositions: true,
        maxLevels: true,
        maxBacktestsMonth: true,
        hasTrailingSL: true,
        hasAdvancedGrid: true,
        hasOptimizador: true,
        hasBacktestsIlimitados: true,
        hasPaperTrading: true,
        hasMetricsDashboard: true,
        hasMultiCuenta: true,
        hasApiAccess: true,
        hasVpsDedicado: true,
        hasPriority: true,
        hasSoporte247: true,
      },
    }),
  ]);

  return {
    current: limits,
    plans,
  };
}
