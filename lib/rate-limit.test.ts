import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  getRateLimitKey,
  getClientIp,
  clearRateLimits,
  RATE_LIMITS,
  createRateLimitHeaders,
  rateLimitErrorResponse,
} from "./rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    // Limpiar rate limits antes de cada test
    clearRateLimits();
  });

  describe("checkRateLimit", () => {
    it("should allow first request", () => {
      const result = checkRateLimit("test-key", { max: 5, windowMs: 60000 });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.retryAfter).toBeUndefined();
    });

    it("should count down remaining requests", () => {
      const config = { max: 3, windowMs: 60000 };

      const result1 = checkRateLimit("test-key", config);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(2);

      const result2 = checkRateLimit("test-key", config);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(1);

      const result3 = checkRateLimit("test-key", config);
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(0);
    });

    it("should block requests after limit reached", () => {
      const config = { max: 2, windowMs: 60000 };

      checkRateLimit("test-key", config);
      checkRateLimit("test-key", config);

      const result = checkRateLimit("test-key", config);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it("should reset after window expires", async () => {
      const config = { max: 1, windowMs: 100 }; // 100ms window

      // First request
      const result1 = checkRateLimit("test-key", config);
      expect(result1.allowed).toBe(true);

      // Second request should be blocked
      const result2 = checkRateLimit("test-key", config);
      expect(result2.allowed).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be allowed again
      const result3 = checkRateLimit("test-key", config);
      expect(result3.allowed).toBe(true);
    });

    it("should track different keys independently", () => {
      const config = { max: 1, windowMs: 60000 };

      const result1 = checkRateLimit("key-1", config);
      expect(result1.allowed).toBe(true);

      const result2 = checkRateLimit("key-2", config);
      expect(result2.allowed).toBe(true);

      const result3 = checkRateLimit("key-1", config);
      expect(result3.allowed).toBe(false);
    });
  });

  describe("getRateLimitKey", () => {
    it("should extract IP from x-forwarded-for header", () => {
      const request = new Request("http://localhost/api/test", {
        headers: { "x-forwarded-for": "192.168.1.1, 10.0.0.1" },
      });

      const key = getRateLimitKey(request, "api");
      expect(key).toBe("api:192.168.1.1");
    });

    it("should extract IP from x-real-ip header", () => {
      const request = new Request("http://localhost/api/test", {
        headers: { "x-real-ip": "192.168.1.2" },
      });

      const key = getRateLimitKey(request, "api");
      expect(key).toBe("api:192.168.1.2");
    });

    it("should use 'unknown' if no IP headers", () => {
      const request = new Request("http://localhost/api/test");
      const key = getRateLimitKey(request, "api");
      expect(key).toBe("api:unknown");
    });
  });

  describe("getClientIp", () => {
    it("should return first IP from x-forwarded-for", () => {
      const request = new Request("http://localhost", {
        headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
      });
      expect(getClientIp(request)).toBe("1.2.3.4");
    });

    it("should trim whitespace from IP", () => {
      const request = new Request("http://localhost", {
        headers: { "x-forwarded-for": "  1.2.3.4  , 5.6.7.8" },
      });
      expect(getClientIp(request)).toBe("1.2.3.4");
    });
  });

  describe("RATE_LIMITS presets", () => {
    it("should have login preset", () => {
      expect(RATE_LIMITS.login).toEqual({ max: 5, windowMs: 15 * 60 * 1000 });
    });

    it("should have register preset", () => {
      expect(RATE_LIMITS.register).toEqual({ max: 3, windowMs: 60 * 60 * 1000 });
    });

    it("should have bot preset", () => {
      expect(RATE_LIMITS.bot).toEqual({ max: 100, windowMs: 60 * 1000 });
    });

    it("should have api preset", () => {
      expect(RATE_LIMITS.api).toEqual({ max: 60, windowMs: 60 * 1000 });
    });
  });

  describe("createRateLimitHeaders", () => {
    it("should create standard rate limit headers", () => {
      const result = checkRateLimit("test", { max: 10, windowMs: 60000 });
      const headers = createRateLimitHeaders(result);

      expect(headers.get("X-RateLimit-Limit")).toBe("10");
      expect(headers.get("X-RateLimit-Remaining")).toBe("9");
      expect(headers.get("X-RateLimit-Reset")).toBeDefined();
    });

    it("should include Retry-After when blocked", () => {
      const config = { max: 1, windowMs: 60000 };
      checkRateLimit("test", config);
      const result = checkRateLimit("test", config);
      const headers = createRateLimitHeaders(result);

      expect(headers.get("Retry-After")).toBeDefined();
    });

    it("should not include Retry-After when allowed", () => {
      const result = checkRateLimit("test", { max: 10, windowMs: 60000 });
      const headers = createRateLimitHeaders(result);

      expect(headers.get("Retry-After")).toBeNull();
    });
  });

  describe("rateLimitErrorResponse", () => {
    it("should create 429 response with correct structure", () => {
      const config = { max: 1, windowMs: 60000 };
      checkRateLimit("test", config);
      const result = checkRateLimit("test", config);

      const response = rateLimitErrorResponse(result);

      expect(response.status).toBe(429);
    });
  });
});
