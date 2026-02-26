import { z } from "zod";
import { protectedProcedure, router } from "../init";
import { prisma } from "@/lib/prisma";

export const notificationsRouter = router({
  // Listar notificaciones del usuario
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        unreadOnly: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      return prisma.notification.findMany({
        where: {
          userId: ctx.user.id,
          ...(input.unreadOnly && { isRead: false }),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),

  // Contador de no leidas
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return prisma.notification.count({
      where: {
        userId: ctx.user.id,
        isRead: false,
      },
    });
  }),

  // Marcar como leida
  markAsRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return prisma.notification.updateMany({
        where: {
          id: input.id,
          userId: ctx.user.id,
        },
        data: { isRead: true },
      });
    }),

  // Marcar todas como leidas
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    return prisma.notification.updateMany({
      where: {
        userId: ctx.user.id,
        isRead: false,
      },
      data: { isRead: true },
    });
  }),

  // Crear notificacion (helper para otros routers)
  create: protectedProcedure
    .input(
      z.object({
        type: z.enum(["INFO", "SUCCESS", "WARNING", "ERROR"]),
        title: z.string(),
        message: z.string(),
        link: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return prisma.notification.create({
        data: {
          userId: ctx.user.id,
          ...input,
        },
      });
    }),
});
