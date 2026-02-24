/**
 * Router para gestionar estrategias guardadas
 *
 * Permite a los usuarios guardar configuraciones de backtest
 * y reutilizarlas posteriormente.
 */

import { z } from "zod";
import { procedure, router } from "../init";
import { prisma } from "@/lib/prisma";

// Schema para crear/actualizar estrategia
const StrategyInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  strategyName: z.string().default("Custom"),
  lotajeBase: z.number().min(0.01).max(10).default(0.1),
  numOrders: z.number().min(1).max(5).default(1),
  pipsDistance: z.number().min(1).max(100).default(10),
  maxLevels: z.number().min(1).max(40).default(4),
  takeProfitPips: z.number().min(5).max(100).default(20),
  stopLossPips: z.number().min(0).max(500).optional(),
  useStopLoss: z.boolean().default(false),
  useTrailingSL: z.boolean().default(true),
  trailingSLPercent: z.number().min(10).max(90).default(50),
  restrictionType: z.enum(["RIESGO", "SIN_PROMEDIOS", "SOLO_1_PROMEDIO"]).optional(),
});

export const strategiesRouter = router({
  /**
   * Lista todas las estrategias del usuario
   */
  list: procedure.query(async ({ ctx }) => {
    // Por ahora usamos un tenant por defecto
    // TODO: Obtener tenant del contexto de autenticación
    let tenant = await prisma.tenant.findFirst();

    if (!tenant) {
      // Crear tenant por defecto si no existe
      tenant = await prisma.tenant.create({
        data: {
          name: "Default Tenant",
          email: "default@example.com",
        },
      });
    }

    const strategies = await prisma.strategy.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: [
        { isFavorite: "desc" },
        { updatedAt: "desc" },
      ],
    });

    return strategies;
  }),

  /**
   * Obtiene una estrategia por ID
   */
  get: procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const strategy = await prisma.strategy.findUnique({
        where: { id: input.id },
      });

      return strategy;
    }),

  /**
   * Crea una nueva estrategia
   */
  create: procedure
    .input(StrategyInputSchema)
    .mutation(async ({ input }) => {
      let tenant = await prisma.tenant.findFirst();

      if (!tenant) {
        tenant = await prisma.tenant.create({
          data: {
            name: "Default Tenant",
            email: "default@example.com",
          },
        });
      }

      const strategy = await prisma.strategy.create({
        data: {
          tenantId: tenant.id,
          ...input,
        },
      });

      return strategy;
    }),

  /**
   * Actualiza una estrategia existente
   */
  update: procedure
    .input(z.object({
      id: z.string(),
      data: StrategyInputSchema.partial(),
    }))
    .mutation(async ({ input }) => {
      const strategy = await prisma.strategy.update({
        where: { id: input.id },
        data: input.data,
      });

      return strategy;
    }),

  /**
   * Actualiza los resultados del último backtest
   */
  updateResults: procedure
    .input(z.object({
      id: z.string(),
      results: z.object({
        totalTrades: z.number(),
        totalProfit: z.number(),
        winRate: z.number(),
        maxDrawdown: z.number(),
      }),
    }))
    .mutation(async ({ input }) => {
      const strategy = await prisma.strategy.update({
        where: { id: input.id },
        data: {
          lastTotalTrades: input.results.totalTrades,
          lastTotalProfit: input.results.totalProfit,
          lastWinRate: input.results.winRate,
          lastMaxDrawdown: input.results.maxDrawdown,
          lastTestedAt: new Date(),
        },
      });

      return strategy;
    }),

  /**
   * Marca/desmarca como favorita
   */
  toggleFavorite: procedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const current = await prisma.strategy.findUnique({
        where: { id: input.id },
        select: { isFavorite: true },
      });

      const strategy = await prisma.strategy.update({
        where: { id: input.id },
        data: { isFavorite: !current?.isFavorite },
      });

      return strategy;
    }),

  /**
   * Elimina una estrategia (soft delete)
   */
  delete: procedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const strategy = await prisma.strategy.update({
        where: { id: input.id },
        data: { isActive: false },
      });

      return { success: true };
    }),

  /**
   * Duplica una estrategia
   */
  duplicate: procedure
    .input(z.object({ id: z.string(), newName: z.string().optional() }))
    .mutation(async ({ input }) => {
      const original = await prisma.strategy.findUnique({
        where: { id: input.id },
      });

      if (!original) {
        throw new Error("Estrategia no encontrada");
      }

      const { id, createdAt, updatedAt, ...data } = original;

      const duplicated = await prisma.strategy.create({
        data: {
          ...data,
          name: input.newName || `${original.name} (copia)`,
          isFavorite: false,
          lastTotalTrades: null,
          lastTotalProfit: null,
          lastWinRate: null,
          lastMaxDrawdown: null,
          lastTestedAt: null,
        },
      });

      return duplicated;
    }),
});
