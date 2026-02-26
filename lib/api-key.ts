/**
 * Utilidades para generación y validación de API keys del bot
 */

import { randomBytes } from "crypto";
import { hash, compare } from "bcrypt";

// Prefijo para identificar API keys del bot
const BOT_API_KEY_PREFIX = "tb_";

// Rounds de bcrypt para hashear API keys
const BCRYPT_ROUNDS = 12;

/**
 * Genera una API key raw y su hash para almacenar
 * @returns Objeto con apiKey (mostrar al usuario una vez) y apiKeyHash (guardar en DB)
 */
export async function generateApiKey(): Promise<{ apiKey: string; apiKeyHash: string }> {
  // Generar 32 bytes aleatorios y convertir a base64url (sin caracteres problemáticos)
  const randomPart = randomBytes(32).toString("base64url");

  // API key completa: tb_xxxxxxxxxxxxx
  const apiKey = `${BOT_API_KEY_PREFIX}${randomPart}`;

  // Hashear para almacenar en DB
  const apiKeyHash = await hash(apiKey, BCRYPT_ROUNDS);

  return { apiKey, apiKeyHash };
}

/**
 * Valida una API key contra un hash
 * @param apiKey - API key proporcionada por el bot
 * @param apiKeyHash - Hash almacenado en DB
 * @returns true si la API key es válida
 */
export async function validateApiKey(apiKey: string, apiKeyHash: string): Promise<boolean> {
  // Verificar formato básico
  if (!apiKey.startsWith(BOT_API_KEY_PREFIX)) {
    return false;
  }

  return compare(apiKey, apiKeyHash);
}

/**
 * Extrae la API key del header Authorization
 * Formato esperado: "Bearer tb_xxxxxxxxxxxxx"
 */
export function extractApiKeyFromHeader(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  const apiKey = parts[1];
  if (!apiKey.startsWith(BOT_API_KEY_PREFIX)) {
    return null;
  }

  return apiKey;
}

/**
 * Valida el formato de una API key sin verificar contra DB
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  return (
    apiKey.startsWith(BOT_API_KEY_PREFIX) &&
    apiKey.length > BOT_API_KEY_PREFIX.length + 20
  );
}
