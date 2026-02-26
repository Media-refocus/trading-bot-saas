/**
 * Utilidades de cifrado para credenciales sensibles
 * Usa AES-256-GCM para cifrar credenciales MT5 y Telegram
 *
 * IMPORTANTE: En producción, CREDENTIALS_ENCRYPTION_KEY es OBLIGATORIO
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Clave de cifrado desde variable de entorno (32 bytes = 256 bits)
// Generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const ENCRYPTION_KEY = process.env.CREDENTIALS_ENCRYPTION_KEY;

/**
 * Cifra un texto plano usando AES-256-GCM
 * @param plaintext - Texto a cifrar (ej: contraseña MT5)
 * @returns String cifrado en formato "iv:authTag:ciphertext" (hex)
 */
export function encryptCredential(plaintext: string): string {
  if (!ENCRYPTION_KEY) {
    // En producción, la clave de encriptación es OBLIGATORIA
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CREDENTIALS_ENCRYPTION_KEY must be set in production. " +
          "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      );
    }
    // En desarrollo sin clave, guardar con prefijo para identificar
    console.warn(
      "⚠️ CREDENTIALS_ENCRYPTION_KEY no definida. Las credenciales no se cifrarán."
    );
    return `PLAINTEXT:${plaintext}`;
  }

  const iv = randomBytes(16);
  const cipher = createCipheriv(
    "aes-256-gcm",
    Buffer.from(ENCRYPTION_KEY, "hex"),
    iv
  );

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Formato: iv:authTag:ciphertext (todos en hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Descifra un texto cifrado con AES-256-GCM
 * @param encrypted - String cifrado en formato "iv:authTag:ciphertext"
 * @returns Texto plano descifrado
 */
export function decryptCredential(encrypted: string): string {
  // Si no había clave de cifrado, el valor tiene prefijo PLAINTEXT:
  if (encrypted.startsWith("PLAINTEXT:")) {
    // En producción no permitimos credenciales en texto plano
    if (process.env.NODE_ENV === "production") {
      throw new Error("Cannot decrypt plaintext credentials in production");
    }
    return encrypted.slice(10);
  }

  if (!ENCRYPTION_KEY) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY no definida. No se pueden descifrar credenciales."
    );
  }

  const [ivHex, authTagHex, ciphertext] = encrypted.split(":");

  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error("Formato de credencial cifrada inválido");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(ENCRYPTION_KEY, "hex"),
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Verifica si una clave de cifrado está configurada
 */
export function isEncryptionAvailable(): boolean {
  return !!ENCRYPTION_KEY && ENCRYPTION_KEY.length === 64;
}

/**
 * Genera una nueva clave de cifrado para usar en .env
 * (Solo para setup inicial)
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}
