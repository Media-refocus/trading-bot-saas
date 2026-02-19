/**
 * Inicialización del servidor
 *
 * Este archivo se ejecuta al arrancar el servidor Next.js
 * Precarga TODOS los ticks en memoria para backtests instantáneos
 */

export async function register() {
  // Solo ejecutar en el servidor, no en edge
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[Server] ========================================");
    console.log("[Server] INICIALIZANDO SERVIDOR DE BACKTESTING");
    console.log("[Server] ========================================");

    // Inicializar índice y luego precargar TODOS los ticks
    import("./lib/ticks-cache").then(({ initializeTicksCache, preloadAllTicks }) => {
      console.log("[Server] Paso 1: Cargando índice de ticks...");

      initializeTicksCache().then(() => {
        console.log("[Server] Índice listo.");
        console.log("[Server] Paso 2: Precargando TODOS los ticks en memoria...");
        console.log("[Server] (Esto tardará 5-10 minutos, pero luego los backtests serán instantáneos)");

        preloadAllTicks().then(() => {
          console.log("[Server] ========================================");
          console.log("[Server] ¡SERVIDOR LISTO! Todos los ticks en memoria.");
          console.log("[Server] Los backtests ahora serán instantáneos.");
          console.log("[Server] ========================================");
        }).catch(err => {
          console.error("[Server] Error en precarga de ticks:", err);
        });
      }).catch(err => {
        console.error("[Server] Error inicializando índice:", err);
      });
    }).catch(err => {
      console.error("[Server] Error importando ticks-cache:", err);
    });
  }
}
