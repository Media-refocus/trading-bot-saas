/**
 * Inicialización del servidor
 *
 * Con SQLite como cache de ticks:
 * - No necesitamos precargar nada en memoria
 * - Los ticks se consultan directamente desde la BD
 * - Bajo uso de memoria (~50MB vs ~1GB)
 * - Arranque instantáneo
 */

import { validateProductionConfig } from "@/lib/config";

export async function register() {
  // Solo ejecutar en el servidor, no en edge
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Debug: log available env vars
    console.log("[Server] ENV CHECK:");
    console.log("[Server] - DATABASE_URL:", !!process.env.DATABASE_URL);
    console.log("[Server] - AUTH_SECRET:", !!process.env.AUTH_SECRET, process.env.AUTH_SECRET?.length || 0, "chars");
    console.log("[Server] - CREDENTIALS_ENCRYPTION_KEY:", !!process.env.CREDENTIALS_ENCRYPTION_KEY, process.env.CREDENTIALS_ENCRYPTION_KEY?.length || 0, "chars");
    
    // Validar configuracion obligatoria en produccion
    try {
      validateProductionConfig();
    } catch (error) {
      console.error("[Server] CONFIG VALIDATION FAILED:", error);
      // Don't throw - allow server to start for debugging
    }

    console.log("[Server] ========================================");
    console.log("[Server] Trading Bot SaaS - Backtester");
    console.log("[Server] ========================================");
    console.log("[Server] Arquitectura: SQLite para ticks");
    console.log("[Server] Memoria estimada: ~50MB");
    console.log("[Server] Listo para recibir peticiones.");
    console.log("[Server] ========================================");
  }
}
