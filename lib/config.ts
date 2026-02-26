/**
 * Validacion de configuracion de la aplicacion
 *
 * Verifica que todas las variables de entorno requeridas
 * esten configuradas correctamente antes de iniciar la app.
 */

/**
 * Valida la configuracion requerida en produccion
 * Lanza error si faltan variables obligatorias
 */
export function validateProductionConfig(): void {
  if (process.env.NODE_ENV === "production") {
    const required = [
      "DATABASE_URL",
      "AUTH_SECRET",
      "CREDENTIALS_ENCRYPTION_KEY",
    ];

    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}\n` +
          "Please set these variables before starting the application."
      );
    }

    // Validar que AUTH_SECRET tenga longitud minima
    if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length < 32) {
      throw new Error("AUTH_SECRET must be at least 32 characters long");
    }

    // Validar que CREDENTIALS_ENCRYPTION_KEY tenga longitud correcta (64 hex chars = 32 bytes)
    if (
      process.env.CREDENTIALS_ENCRYPTION_KEY &&
      process.env.CREDENTIALS_ENCRYPTION_KEY.length !== 64
    ) {
      throw new Error(
        "CREDENTIALS_ENCRYPTION_KEY must be exactly 64 characters (32 bytes in hex format). " +
          'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }
  }
}
