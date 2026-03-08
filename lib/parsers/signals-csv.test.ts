/**
 * Tests del Parser de Señales CSV
 *
 * Verifica:
 * - Parsing de líneas CSV individuales
 * - Agrupación de señales open/close por rangeId
 * - Manejo de formatos inválidos
 * - Generación de ticks sintéticos
 */

import { describe, it, expect } from "vitest";
import {
  parseSignalsCsv,
  groupSignalsByRange,
  generateSyntheticTicks,
  RawSignal,
} from "./signals-csv";

// ==================== TEST DATA ====================

const validCsvContent = `ts_utc;kind;side;price_hint;range_id;message_id;confidence
2025-01-15T10:00:00Z;range_open;BUY;2650.50;range_001;123;0.95
2025-01-15T11:00:00Z;range_close;;2651.50;range_001;124;0.90
2025-01-15T12:00:00Z;range_open;SELL;2660.00;range_002;125;0.92
2025-01-15T13:00:00Z;range_close;;2659.00;range_002;126;0.88`;

const csvWithMissingFields = `ts_utc;kind;side;price_hint;range_id;message_id;confidence
2025-01-15T10:00:00Z;range_open;BUY;2650.50;range_001;123`;

const csvWithInvalidSide = `ts_utc;kind;side;price_hint;range_id;message_id;confidence
2025-01-15T10:00:00Z;range_open;INVALID;2650.50;range_001;123;0.95`;

const csvWithOrphanClose = `ts_utc;kind;side;price_hint;range_id;message_id;confidence
2025-01-15T10:00:00Z;range_close;;2650.50;range_orphan;123;0.95`;

// ==================== TESTS ====================

describe("parseSignalsCsv", () => {
  it("debe parsear contenido CSV válido", () => {
    const signals = parseSignalsCsv(validCsvContent);

    expect(signals).toHaveLength(4);
    expect(signals[0].side).toBe("BUY");
    expect(signals[0].kind).toBe("range_open");
    expect(signals[0].priceHint).toBe(2650.50);
    expect(signals[0].rangeId).toBe("range_001");
    expect(signals[0].confidence).toBe(0.95);
  });

  it("debe parsear timestamp correctamente", () => {
    const signals = parseSignalsCsv(validCsvContent);

    expect(signals[0].timestamp).toBeInstanceOf(Date);
    expect(signals[0].timestamp.toISOString()).toBe("2025-01-15T10:00:00.000Z");
  });

  it("debe manejar líneas vacías", () => {
    const contentWithEmptyLines = validCsvContent + "\n\n\n";
    const signals = parseSignalsCsv(contentWithEmptyLines);

    expect(signals).toHaveLength(4);
  });

  it("debe retornar array vacío para contenido vacío", () => {
    const signals = parseSignalsCsv("");
    expect(signals).toHaveLength(0);
  });

  it("debe ignororar líneas con campos insuficientes", () => {
    const signals = parseSignalsCsv(csvWithMissingFields);

    // La línea con campos faltantes debería retornar null y no agregarse
    expect(signals).toHaveLength(0);
  });

  it("debe manejar side nulo para valores inválidos", () => {
    const signals = parseSignalsCsv(csvWithInvalidSide);

    expect(signals).toHaveLength(1);
    expect(signals[0].side).toBeNull();
  });

  it("debe parsear priceHint como null si está vacío", () => {
    const content = `ts_utc;kind;side;price_hint;range_id;message_id;confidence
2025-01-15T10:00:00Z;range_open;BUY;;range_001;123;0.95`;

    const signals = parseSignalsCsv(content);

    expect(signals[0].priceHint).toBeNull();
  });

  it("debe parsear confidence como null si está vacío", () => {
    const content = `ts_utc;kind;side;price_hint;range_id;message_id;confidence
2025-01-15T10:00:00Z;range_open;BUY;2650.50;range_001;123;`;

    const signals = parseSignalsCsv(content);

    expect(signals[0].confidence).toBeNull();
  });

  it("debe parsear messageId como entero", () => {
    const signals = parseSignalsCsv(validCsvContent);

    expect(signals[0].messageId).toBe(123);
    expect(typeof signals[0].messageId).toBe("number");
  });
});

describe("groupSignalsByRange", () => {
  it("debe agrupar señales open/close por rangeId", () => {
    const rawSignals = parseSignalsCsv(validCsvContent);
    const tradingSignals = groupSignalsByRange(rawSignals);

    expect(tradingSignals).toHaveLength(2);

    // Primera señal (BUY)
    expect(tradingSignals[0].side).toBe("BUY");
    expect(tradingSignals[0].entryPrice).toBe(2650.50);
    expect(tradingSignals[0].closeTimestamp).toBeDefined();

    // Segunda señal (SELL)
    expect(tradingSignals[1].side).toBe("SELL");
    expect(tradingSignals[1].entryPrice).toBe(2660.00);
  });

  it("debe ignororar señales sin side", () => {
    const rawSignals = parseSignalsCsv(csvWithInvalidSide);
    const tradingSignals = groupSignalsByRange(rawSignals);

    // La señal con side INVALIDO debe ser ignorada
    expect(tradingSignals).toHaveLength(0);
  });

  it("debe manejar señales open sin close", () => {
    const content = `ts_utc;kind;side;price_hint;range_id;message_id;confidence
2025-01-15T10:00:00Z;range_open;BUY;2650.50;range_noclose;123;0.95`;

    const rawSignals = parseSignalsCsv(content);
    const tradingSignals = groupSignalsByRange(rawSignals);

    expect(tradingSignals).toHaveLength(1);
    expect(tradingSignals[0].closeTimestamp).toBeUndefined();
  });

  it("debe manejar señales close sin open (orphan)", () => {
    const rawSignals = parseSignalsCsv(csvWithOrphanClose);
    const tradingSignals = groupSignalsByRange(rawSignals);

    // El close sin open no genera trading signal
    expect(tradingSignals).toHaveLength(0);
  });

  it("debe ordenar señales por timestamp", () => {
    const content = `ts_utc;kind;side;price_hint;range_id;message_id;confidence
2025-01-15T15:00:00Z;range_open;SELL;2670.00;range_late;130;0.90
2025-01-15T09:00:00Z;range_open;BUY;2650.00;range_early;120;0.95
2025-01-15T12:00:00Z;range_open;BUY;2660.00;range_mid;125;0.92`;

    const rawSignals = parseSignalsCsv(content);
    const tradingSignals = groupSignalsByRange(rawSignals);

    expect(tradingSignals).toHaveLength(3);
    expect(tradingSignals[0].rangeId).toBe("range_early");
    expect(tradingSignals[1].rangeId).toBe("range_mid");
    expect(tradingSignals[2].rangeId).toBe("range_late");
  });

  it("debe usar confidence default de 0.95 si no está especificado", () => {
    const content = `ts_utc;kind;side;price_hint;range_id;message_id;confidence
2025-01-15T10:00:00Z;range_open;BUY;2650.50;range_001;123;`;

    const rawSignals = parseSignalsCsv(content);
    const tradingSignals = groupSignalsByRange(rawSignals);

    expect(tradingSignals[0].confidence).toBe(0.95);
  });

  it("debe usar entryPrice de 0 si priceHint no está disponible", () => {
    const content = `ts_utc;kind;side;price_hint;range_id;message_id;confidence
2025-01-15T10:00:00Z;range_open;BUY;;range_001;123;0.95`;

    const rawSignals = parseSignalsCsv(content);
    const tradingSignals = groupSignalsByRange(rawSignals);

    expect(tradingSignals[0].entryPrice).toBe(0);
  });
});

describe("generateSyntheticTicks", () => {
  it("debe generar array de ticks con longitud adecuada", () => {
    const entryPrice = 2650.0;
    const exitPrice = 2655.0;
    const durationMs = 60 * 60 * 1000; // 1 hora

    const ticks = generateSyntheticTicks(entryPrice, exitPrice, durationMs);

    // ~1 tick por segundo = 3600 ticks, pero limitado a 2000
    expect(ticks.length).toBeGreaterThan(200);
    expect(ticks.length).toBeLessThanOrEqual(2001); // numTicks + 1 (del <=)
  });

  it("debe generar ticks con estructura correcta", () => {
    const ticks = generateSyntheticTicks(2650.0, 2655.0, 60000);

    expect(ticks[0]).toHaveProperty("timestamp");
    expect(ticks[0]).toHaveProperty("bid");
    expect(ticks[0]).toHaveProperty("ask");
    expect(ticks[0]).toHaveProperty("spread");
  });

  it("debe generar spread realista para XAUUSD (15-25 pips)", () => {
    const ticks = generateSyntheticTicks(2650.0, 2655.0, 60000);

    for (const tick of ticks) {
      // Spread típico: 0.15 - 0.25 (15-25 pips)
      expect(tick.spread).toBeGreaterThan(0.10);
      expect(tick.spread).toBeLessThan(0.35);
    }
  });

  it("debe generar ask > bid", () => {
    const ticks = generateSyntheticTicks(2650.0, 2655.0, 60000);

    for (const tick of ticks) {
      expect(tick.ask).toBeGreaterThan(tick.bid);
    }
  });

  it("debe generar timestamps progresivos", () => {
    const startTime = new Date("2025-01-15T10:00:00Z");
    const ticks = generateSyntheticTicks(2650.0, 2655.0, 60000, 100, startTime);

    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i].timestamp.getTime()).toBeGreaterThan(
        ticks[i - 1].timestamp.getTime()
      );
    }
  });

  it("debe usar timestamp actual si no se especifica", () => {
    const before = Date.now();
    const ticks = generateSyntheticTicks(2650.0, 2655.0, 60000);
    const after = Date.now();

    const firstTickTime = ticks[0].timestamp.getTime();
    expect(firstTickTime).toBeGreaterThanOrEqual(before - 60000 - 100);
    expect(firstTickTime).toBeLessThanOrEqual(after);
  });

  it("debe mantener precio cercano al entry (mean reversion)", () => {
    const entryPrice = 2650.0;
    const ticks = generateSyntheticTicks(entryPrice, 2655.0, 60000, 50);

    // Calcular precio promedio
    const avgPrice =
      ticks.reduce((sum, t) => sum + t.bid, 0) / ticks.length;

    // El precio promedio no debe alejarse demasiado del entry
    // Con volatilidad baja, la desviación debe ser pequeña
    const deviation = Math.abs(avgPrice - entryPrice);
    expect(deviation).toBeLessThan(5.0); // Menos de 50 pips de desviación
  });

  it("debe respetar el parámetro de volatilidad", () => {
    const entryPrice = 2650.0;

    // Volatilidad baja
    const lowVolTicks = generateSyntheticTicks(entryPrice, 2655.0, 60000, 20);

    // Volatilidad alta
    const highVolTicks = generateSyntheticTicks(entryPrice, 2655.0, 60000, 200);

    // Calcular rango de precios
    const lowVolRange =
      Math.max(...lowVolTicks.map((t) => t.bid)) -
      Math.min(...lowVolTicks.map((t) => t.bid));

    const highVolRange =
      Math.max(...highVolTicks.map((t) => t.bid)) -
      Math.min(...highVolTicks.map((t) => t.bid));

    // Alta volatilidad debería generar mayor rango (en promedio)
    // Nota: Es probabilístico, así que usamos un margen amplio
    expect(highVolRange).toBeGreaterThan(lowVolRange * 0.5);
  });
});

describe("Edge Cases - Signal Parsing", () => {
  it("debe manejar CSV con espacios en blanco", () => {
    const content = `ts_utc;kind;side;price_hint;range_id;message_id;confidence
  2025-01-15T10:00:00Z  ;  range_open  ;  BUY  ;  2650.50  ;  range_001  ;  123  ;  0.95  `;

    const signals = parseSignalsCsv(content);

    // Los espacios deberían ser manejados
    expect(signals).toHaveLength(1);
  });

  it("debe manejar números decimales en priceHint", () => {
    const content = `ts_utc;kind;side;price_hint;range_id;message_id;confidence
2025-01-15T10:00:00Z;range_open;BUY;2650.123456;range_001;123;0.95`;

    const signals = parseSignalsCsv(content);

    expect(signals[0].priceHint).toBeCloseTo(2650.123456, 4);
  });

  it("debe manejar múltiples señales con el mismo rangeId (última gana)", () => {
    const content = `ts_utc;kind;side;price_hint;range_id;message_id;confidence
2025-01-15T10:00:00Z;range_open;BUY;2650.00;range_dup;123;0.95
2025-01-15T10:30:00Z;range_open;SELL;2660.00;range_dup;124;0.90
2025-01-15T11:00:00Z;range_close;;2655.00;range_dup;125;0.88`;

    const rawSignals = parseSignalsCsv(content);
    const tradingSignals = groupSignalsByRange(rawSignals);

    // Solo debería haber 1 señal por rangeId
    expect(tradingSignals).toHaveLength(1);
  });
});
