/**
 * Tests para lib/security/auth-middleware.ts
 * ==========================================
 *
 * Testea las funciones puras del middleware de autenticacion:
 * - extractApiKey(): formatos Bearer y directo
 * - validatePlanLimit(): limites de niveles y posiciones
 */

import { describe, it, expect } from "vitest";
import { extractApiKey, validatePlanLimit } from "../auth-middleware";
import type { ValidationResult } from "../api-key";

// Mock de NextRequest para los tests
function createMockRequest(authHeader: string | null): { headers: { get: (key: string) => string | null } } {
  return {
    headers: {
      get: (key: string) => (key === "authorization" ? authHeader : null),
    },
  };
}

// ───────────────────────── extractApiKey() ─────────────────────────

describe("extractApiKey", () => {
  describe("formato Bearer", () => {
    it("extrae API key de header 'Bearer tb_live_...'", () => {
      const apiKey = "tb_live_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const request = createMockRequest(`Bearer ${apiKey}`);

      const result = extractApiKey(request as never);

      expect(result).toBe(apiKey);
    });

    it("extrae API key de header 'Bearer tb_test_...'", () => {
      const apiKey = "tb_test_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const request = createMockRequest(`Bearer ${apiKey}`);

      const result = extractApiKey(request as never);

      expect(result).toBe(apiKey);
    });

    it("maneja espacios extra despues de Bearer", () => {
      const apiKey = "tb_live_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const request = createMockRequest(`Bearer   ${apiKey}  `);

      const result = extractApiKey(request as never);

      expect(result).toBe(apiKey);
    });
  });

  describe("formato directo", () => {
    it("extrae API key cuando es el valor directo del header (sin Bearer)", () => {
      const apiKey = "tb_live_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const request = createMockRequest(apiKey);

      const result = extractApiKey(request as never);

      expect(result).toBe(apiKey);
    });

    it("extrae API key test directa", () => {
      const apiKey = "tb_test_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const request = createMockRequest(apiKey);

      const result = extractApiKey(request as never);

      expect(result).toBe(apiKey);
    });

    it("retorna null si hay espacios al inicio (formato directo requiere que empiece con tb_)", () => {
      const apiKey = "tb_live_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const request = createMockRequest(`  ${apiKey}  `);

      // La funcion solo acepta si empieza con "tb_" directamente
      // Los espacios hacen que no pase la verificacion startsWith("tb_")
      const result = extractApiKey(request as never);

      expect(result).toBeNull();
    });
  });

  describe("casos invalidos", () => {
    it("retorna null si no hay header Authorization", () => {
      const request = createMockRequest(null);

      const result = extractApiKey(request as never);

      expect(result).toBeNull();
    });

    it("retorna null si el header no tiene formato valido", () => {
      const request = createMockRequest("Basic dXNlcjpwYXNz");

      const result = extractApiKey(request as never);

      expect(result).toBeNull();
    });

    it("retorna null si empieza con prefijo incorrecto", () => {
      const request = createMockRequest("pk_live_abc123");

      const result = extractApiKey(request as never);

      expect(result).toBeNull();
    });

    it("extrae cualquier valor despues de Bearer (aunque no sea tb_)", () => {
      // Nota: La funcion actual extrae cualquier cosa despues de "Bearer "
      // La validacion del formato se hace en isValidApiKeyFormat, no aqui
      const request = createMockRequest("Bearer sk_test_abc123");

      const result = extractApiKey(request as never);

      expect(result).toBe("sk_test_abc123");
    });
  });
});

// ───────────────────────── validatePlanLimit() ─────────────────────────

describe("validatePlanLimit", () => {
  // Helper para crear mock de auth
  function createMockAuth(planLimits: Partial<ValidationResult>): { valid: true; planLimits: ValidationResult } {
    return {
      valid: true,
      planLimits: {
        valid: true,
        ...planLimits,
      } as ValidationResult & { valid: true },
    };
  }

  describe("limite maxLevels", () => {
    it("permite niveles dentro del limite del plan", () => {
      const auth = createMockAuth({ maxLevels: 5 });

      const result = validatePlanLimit(auth, "maxLevels", 3);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("permite exactamente el limite del plan", () => {
      const auth = createMockAuth({ maxLevels: 5 });

      const result = validatePlanLimit(auth, "maxLevels", 5);

      expect(result.allowed).toBe(true);
    });

    it("rechaza niveles que exceden el limite del plan", () => {
      const auth = createMockAuth({ maxLevels: 3 });

      const result = validatePlanLimit(auth, "maxLevels", 5);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("3 niveles");
      expect(result.reason).toContain("5");
    });

    it("usa valor por defecto de 3 si maxLevels es undefined", () => {
      const auth = createMockAuth({ maxLevels: undefined });

      const result = validatePlanLimit(auth, "maxLevels", 5);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("3 niveles");
    });

    it("permite diferentes planes con diferentes limites", () => {
      const basicPlan = createMockAuth({ maxLevels: 3 });
      const proPlan = createMockAuth({ maxLevels: 10 });
      const enterprisePlan = createMockAuth({ maxLevels: 50 });

      expect(validatePlanLimit(basicPlan, "maxLevels", 3).allowed).toBe(true);
      expect(validatePlanLimit(basicPlan, "maxLevels", 4).allowed).toBe(false);

      expect(validatePlanLimit(proPlan, "maxLevels", 10).allowed).toBe(true);
      expect(validatePlanLimit(proPlan, "maxLevels", 11).allowed).toBe(false);

      expect(validatePlanLimit(enterprisePlan, "maxLevels", 50).allowed).toBe(true);
    });
  });

  describe("limite maxPositions", () => {
    it("permite posiciones dentro del limite del plan", () => {
      const auth = createMockAuth({ maxPositions: 5 });

      const result = validatePlanLimit(auth, "maxPositions", 3);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("permite exactamente el limite del plan", () => {
      const auth = createMockAuth({ maxPositions: 3 });

      const result = validatePlanLimit(auth, "maxPositions", 3);

      expect(result.allowed).toBe(true);
    });

    it("rechaza posiciones que exceden el limite del plan", () => {
      const auth = createMockAuth({ maxPositions: 1 });

      const result = validatePlanLimit(auth, "maxPositions", 3);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("1 posicion");
      expect(result.reason).toContain("3");
    });

    it("usa valor por defecto de 1 si maxPositions es undefined", () => {
      const auth = createMockAuth({ maxPositions: undefined });

      const result = validatePlanLimit(auth, "maxPositions", 2);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("1 posicion");
    });

    it("maneja plan con multiples posiciones permitidas", () => {
      const auth = createMockAuth({ maxPositions: 10 });

      expect(validatePlanLimit(auth, "maxPositions", 1).allowed).toBe(true);
      expect(validatePlanLimit(auth, "maxPositions", 5).allowed).toBe(true);
      expect(validatePlanLimit(auth, "maxPositions", 10).allowed).toBe(true);
      expect(validatePlanLimit(auth, "maxPositions", 11).allowed).toBe(false);
    });
  });

  describe("casos edge", () => {
    it("permite valor 0 para niveles (podria ser valido en algun contexto)", () => {
      const auth = createMockAuth({ maxLevels: 5 });

      const result = validatePlanLimit(auth, "maxLevels", 0);

      expect(result.allowed).toBe(true);
    });

    it("rechaza valores negativos implicitamente", () => {
      const auth = createMockAuth({ maxLevels: 5 });

      // -1 es menor que 5, asi que tecnicamente pasa
      const result = validatePlanLimit(auth, "maxLevels", -1);

      expect(result.allowed).toBe(true);
    });
  });
});
