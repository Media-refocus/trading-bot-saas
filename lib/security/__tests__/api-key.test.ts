/**
 * Tests para lib/security/api-key.ts
 * ===================================
 *
 * Testea las funciones puras de gestion de API keys:
 * - generateApiKey(): formato correcto, prefijos live/test
 * - hashApiKey(): output consistente, diferente input = diferente hash
 * - isValidApiKeyFormat(): validacion de formato
 */

import { describe, it, expect } from "vitest";
import {
  generateApiKey,
  hashApiKey,
  isValidApiKeyFormat,
  API_KEY_LIVE_PREFIX,
  API_KEY_TEST_PREFIX,
} from "../api-key";

// ───────────────────────── generateApiKey() ─────────────────────────

describe("generateApiKey", () => {
  it("genera una API key con prefijo live por defecto", () => {
    const apiKey = generateApiKey();

    expect(apiKey.startsWith(API_KEY_LIVE_PREFIX)).toBe(true);
    expect(apiKey).toMatch(/^tb_live_[a-f0-9]{64}$/);
  });

  it("genera una API key con prefijo test cuando isTest=true", () => {
    const apiKey = generateApiKey(true);

    expect(apiKey.startsWith(API_KEY_TEST_PREFIX)).toBe(true);
    expect(apiKey).toMatch(/^tb_test_[a-f0-9]{64}$/);
  });

  it("genera API keys unicas en cada llamada", () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    const key3 = generateApiKey(true);

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key2).not.toBe(key3);
  });

  it("genera API keys con la longitud correcta (64 chars hex)", () => {
    const liveKey = generateApiKey(false);
    const testKey = generateApiKey(true);

    // Formato: tb_live_ + 64 hex chars = 72 chars total
    expect(liveKey.length).toBe(API_KEY_LIVE_PREFIX.length + 1 + 64);
    expect(testKey.length).toBe(API_KEY_TEST_PREFIX.length + 1 + 64);
  });

  it("genera API keys que pasan la validacion de formato", () => {
    const liveKey = generateApiKey(false);
    const testKey = generateApiKey(true);

    expect(isValidApiKeyFormat(liveKey)).toBe(true);
    expect(isValidApiKeyFormat(testKey)).toBe(true);
  });
});

// ───────────────────────── hashApiKey() ─────────────────────────

describe("hashApiKey", () => {
  it("genera un hash SHA-256 hexadecimal", () => {
    const apiKey = generateApiKey();
    const hash = hashApiKey(apiKey);

    // SHA-256 produce 64 caracteres hexadecimales
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash.length).toBe(64);
  });

  it("es determinista: mismo input = mismo output", () => {
    const apiKey = "tb_live_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const hash1 = hashApiKey(apiKey);
    const hash2 = hashApiKey(apiKey);
    const hash3 = hashApiKey(apiKey);

    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });

  it("diferente input = diferente hash", () => {
    const apiKey1 = generateApiKey();
    const apiKey2 = generateApiKey();

    const hash1 = hashApiKey(apiKey1);
    const hash2 = hashApiKey(apiKey2);

    expect(hash1).not.toBe(hash2);
  });

  it("produce hash diferente para live vs test key con mismo random bytes", () => {
    // Simulamos el caso donde los bytes random serian iguales
    // (aunque en la practica nunca pasaria)
    const fakeKey1 = "tb_live_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const fakeKey2 = "tb_test_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const hash1 = hashApiKey(fakeKey1);
    const hash2 = hashApiKey(fakeKey2);

    // El prefijo diferente produce hash diferente
    expect(hash1).not.toBe(hash2);
  });
});

// ───────────────────────── isValidApiKeyFormat() ─────────────────────────

describe("isValidApiKeyFormat", () => {
  describe("formatos validos", () => {
    it("acepta API keys live validas", () => {
      const validLiveKey = generateApiKey(false);
      expect(isValidApiKeyFormat(validLiveKey)).toBe(true);
    });

    it("acepta API keys test validas", () => {
      const validTestKey = generateApiKey(true);
      expect(isValidApiKeyFormat(validTestKey)).toBe(true);
    });

    it("acepta API key con todos los caracteres hexadecimales validos", () => {
      const key = "tb_live_0000000000000000000000000000000000000000000000000000000000000000";
      expect(isValidApiKeyFormat(key)).toBe(true);
    });

    it("acepta API key con todos los caracteres F", () => {
      const key = "tb_live_ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      expect(isValidApiKeyFormat(key)).toBe(true);
    });
  });

  describe("formatos invalidos", () => {
    it("rechaza strings vacios", () => {
      expect(isValidApiKeyFormat("")).toBe(false);
    });

    it("rechaza API key sin prefijo", () => {
      const key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      expect(isValidApiKeyFormat(key)).toBe(false);
    });

    it("rechaza API key con prefijo incorrecto", () => {
      const key = "pk_live_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      expect(isValidApiKeyFormat(key)).toBe(false);
    });

    it("rechaza API key con caracteres no hexadecimales", () => {
      const key = "tb_live_0123456789ghijkl0123456789abcdef0123456789abcdef0123456789abcdef";
      expect(isValidApiKeyFormat(key)).toBe(false);
    });

    it("rechaza API key con longitud incorrecta (muy corta)", () => {
      const key = "tb_live_0123456789abcdef";
      expect(isValidApiKeyFormat(key)).toBe(false);
    });

    it("rechaza API key con longitud incorrecta (muy larga)", () => {
      const key = "tb_live_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef00";
      expect(isValidApiKeyFormat(key)).toBe(false);
    });

    it("rechaza API key con caracteres mayusculas", () => {
      const key = "tb_live_ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789";
      expect(isValidApiKeyFormat(key)).toBe(false);
    });

    it("rechaza API key sin guion bajo despues del prefijo", () => {
      const key = "tblive0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      expect(isValidApiKeyFormat(key)).toBe(false);
    });

    it("rechaza null/undefined", () => {
      expect(isValidApiKeyFormat(null as unknown as string)).toBe(false);
      expect(isValidApiKeyFormat(undefined as unknown as string)).toBe(false);
    });
  });
});
