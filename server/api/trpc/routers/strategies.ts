/**
 * Router para gestionar estrategias guardadas
 *
 * Permite a los usuarios guardar configuraciones de backtest
 * y reutilizarlas posteriormente.
 */

import { z } from "zod";
import { procedure, protectedProcedure, router } from "../init";
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
   * Lista todas las estrategias del usuario autenticado
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const strategies = await prisma.strategy.findMany({
      where: { tenantId: ctx.user.tenantId, isActive: true },
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
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const strategy = await prisma.strategy.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.user.tenantId,
        },
      });

      return strategy;
    }),

  /**
   * Crea una nueva estrategia
   */
  create: protectedProcedure
    .input(StrategyInputSchema)
    .mutation(async ({ ctx, input }) => {
      const strategy = await prisma.strategy.create({
        data: {
          tenantId: ctx.user.tenantId,
          ...input,
        },
      });

      return strategy;
    }),

  /**
   * Actualiza una estrategia existente
   */
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      data: StrategyInputSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verificar que la estrategia pertenece al tenant del usuario
      const existing = await prisma.strategy.findFirst({
        where: { id: input.id, tenantId: ctx.user.tenantId },
      });

      if (!existing) {
        throw new Error("Estrategia no encontrada");
      }

      const strategy = await prisma.strategy.update({
        where: { id: input.id },
        data: input.data,
      });

      return strategy;
    }),

  /**
   * Actualiza los resultados del ultimo backtest
   */
  updateResults: protectedProcedure
    .input(z.object({
      id: z.string(),
      results: z.object({
        totalTrades: z.number(),
        totalProfit: z.number(),
        winRate: z.number(),
        maxDrawdown: z.number(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verificar que la estrategia pertenece al tenant del usuario
      const existing = await prisma.strategy.findFirst({
        where: { id: input.id, tenantId: ctx.user.tenantId },
      });

      if (!existing) {
        throw new Error("Estrategia no encontrada");
      }

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
  toggleFavorite: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const current = await prisma.strategy.findFirst({
        where: { id: input.id, tenantId: ctx.user.tenantId },
        select: { isFavorite: true },
      });

      if (!current) {
        throw new Error("Estrategia no encontrada");
      }

      const strategy = await prisma.strategy.update({
        where: { id: input.id },
        data: { isFavorite: !current.isFavorite },
      });

      return strategy;
    }),

  /**
   * Elimina una estrategia (soft delete)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verificar que la estrategia pertenece al tenant del usuario
      const existing = await prisma.strategy.findFirst({
        where: { id: input.id, tenantId: ctx.user.tenantId },
      });

      if (!existing) {
        throw new Error("Estrategia no encontrada");
      }

      await prisma.strategy.update({
        where: { id: input.id },
        data: { isActive: false },
      });

      return { success: true };
    }),

  /**
   * Duplica una estrategia
   */
  duplicate: protectedProcedure
    .input(z.object({ id: z.string(), newName: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const original = await prisma.strategy.findFirst({
        where: { id: input.id, tenantId: ctx.user.tenantId },
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
