/**
 * Middleware de Rate Limiting para tRPC
 *
 * Aplica rate limiting a procedimientos tRPC sensibles.
 * Util para proteger endpoints de autenticacion y operaciones costosas.
 *
 * NOTA: Este middleware usa rate limiting en memoria.
 * Para produccion con multiples servidores, usar @upstash/ratelimit con Redis.
 */

import { TRPCError } from "@trpc/server";
import { middleware } from "./init";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type { RateLimitConfig } from "@/lib/rate-limit";

/**
 * Crea un middleware de rate limiting con la configuracion especificada
 *
 * @param config - Configuracion de rate limiting (max requests, window en ms)
 * @returns Middleware de tRPC
 *
 * @example
 * const loginRateLimit = createRateLimitMiddleware(RATE_LIMITS.login);
 *
 * export const authRouter = router({
 *   login: loginRateLimit
 *     .input(loginSchema)
 *     .mutation(async ({ ctx, input }) => { ... }),
 * });
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return middleware(async ({ ctx, next }) => {
    // Usar userId si esta autenticado, sino usar IP
    let key: string;

    if (ctx.user?.id) {
      key = `trpc:user:${ctx.user.id}`;
    } else {
      // Para usuarios no autenticados, usar IP
      const ip =
        ctx.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        ctx.headers.get("x-real-ip") ||
        "unknown";
      key = `trpc:anon:${ip}`;
    }

    const result = checkRateLimit(key, config);

    if (!result.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Demasiadas solicitudes. Intenta de nuevo en ${result.retryAfter} segundos.`,
      });
    }

    // Agregar headers de rate limit al contexto para que el procedimiento pueda usarlos
    return next({
      ctx: {
        rateLimit: {
          remaining: result.remaining,
          resetAt: result.resetAt,
        },
      },
    });
  });
}

/**
 * Middlewares pre-configurados para casos comunes
 */
export const rateLimitMiddlewares = {
  /**
   * Rate limiting para login: 5 intentos por 15 minutos
   */
  login: createRateLimitMiddleware(RATE_LIMITS.login),

  /**
   * Rate limiting para registro: 3 intentos por hora
   */
  register: createRateLimitMiddleware(RATE_LIMITS.register),

  /**
   * Rate limiting para API general: 60 requests por minuto
   */
  api: createRateLimitMiddleware(RATE_LIMITS.api),

  /**
   * Rate limiting para operaciones costosas: 10 por minuto
   */
  expensive: createRateLimitMiddleware({ max: 10, windowMs: 60 * 1000 }),

  /**
   * Rate limiting estricto: 3 por hora
   */
  strict: createRateLimitMiddleware({ max: 3, windowMs: 60 * 60 * 1000 }),
};

/**
 * Helper para aplicar rate limiting a un procedimiento
 *
 * @example
 * export const authRouter = router({
 *   sensitiveAction: withRateLimit("login", procedure)
 *     .mutation(async ({ ctx, input }) => { ... }),
 * });
 */
export function withRateLimit(
  type: keyof typeof rateLimitMiddlewares,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proc: any
) {
  return proc.use(rateLimitMiddlewares[type]);
}
