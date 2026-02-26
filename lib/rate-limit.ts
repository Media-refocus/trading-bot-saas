/**
 * Rate Limiting Simple en Memoria
 *
 * NOTA: Esta implementacion es para desarrollo y servidores unicos.
 * Para produccion con multiples servidores, usar @upstash/ratelimit con Redis.
 *
 * Limitaciones:
 * - No funciona en edge runtime (usa setInterval)
 * - No comparte estado entre multiples instancias del servidor
 * - Se resetea al reiniciar el servidor
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, RateLimitEntry>();

// Limpiar entries expirados cada minuto
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of attempts.entries()) {
      if (now > entry.resetAt) {
        attempts.delete(key);
      }
    }
  }, 60000);
}

export interface RateLimitConfig {
  max: number; // Max requests
  windowMs: number; // Window in milliseconds
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number; // Segundos hasta que se resetee (solo cuando no allowed)
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    // Nueva ventana
    const resetAt = now + config.windowMs;
    attempts.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.max - 1, resetAt };
  }

  if (entry.count >= config.max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, resetAt: entry.resetAt, retryAfter };
  }

  entry.count++;
  return { allowed: true, remaining: config.max - entry.count, resetAt: entry.resetAt };
}

/**
 * Obtiene una key unica para rate limiting basada en la IP del cliente
 */
export function getRateLimitKey(request: Request, prefix: string): string {
  // Usar IP del cliente
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `${prefix}:${ip}`;
}

/**
 * Obtiene la IP del cliente desde una solicitud
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

// Presets de rate limiting
export const RATE_LIMITS = {
  login: { max: 5, windowMs: 15 * 60 * 1000 }, // 5 por 15 min
  register: { max: 3, windowMs: 60 * 60 * 1000 }, // 3 por hora
  bot: { max: 100, windowMs: 60 * 1000 }, // 100 por min
  api: { max: 60, windowMs: 60 * 1000 }, // 60 por min
  passwordReset: { max: 3, windowMs: 60 * 60 * 1000 }, // 3 por hora
  emailVerification: { max: 5, windowMs: 60 * 60 * 1000 }, // 5 por hora
} as const;

/**
 * Crea headers de rate limiting para respuestas HTTP
 */
export function createRateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", String(result.remaining + (result.allowed ? 1 : 0)));
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

  if (!result.allowed && result.retryAfter) {
    headers.set("Retry-After", String(result.retryAfter));
  }

  return headers;
}

/**
 * Funcion auxiliar para crear respuesta de error de rate limit
 */
export function rateLimitErrorResponse(result: RateLimitResult): Response {
  const headers = createRateLimitHeaders(result);
  headers.set("Content-Type", "application/json");

  return new Response(
    JSON.stringify({
      error: "Too Many Requests",
      message: `Demasiadas solicitudes. Intenta de nuevo en ${result.retryAfter} segundos.`,
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers,
    }
  );
}

/**
 * Limpia manualmente todas las entradas de rate limiting
 * Util para tests
 */
export function clearRateLimits(): void {
  attempts.clear();
}

/**
 * Obtiene el numero de entradas activas (util para debugging)
 */
export function getActiveRateLimitEntries(): number {
  return attempts.size;
}
