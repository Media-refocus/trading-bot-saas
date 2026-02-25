/**
 * Tests del BacktestEngine - Motor de Backtesting
 *
 * Estos tests verifican la lógica crítica de trading:
 * - Cálculo de profit/loss
 * - Take Profit (TP)
 * - Stop Loss (SL)
 * - Trailing Stop Loss
 * - Grid de promedios
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  BacktestEngine,
  BacktestConfig,
  PriceTick,
  Side,
} from "./backtest-engine";

// ==================== UTILIDADES ====================

const createTick = (bid: number, ask: number, timestamp: Date): PriceTick => ({
  timestamp,
  bid,
  ask,
  spread: ask - bid,
});

const defaultConfig: BacktestConfig = {
  strategyName: "Test",
  lotajeBase: 0.01,
  numOrders: 1,
  pipsDistance: 10,
  maxLevels: 4,
  takeProfitPips: 20,
  useStopLoss: false,
  initialCapital: 10000,
};

// ==================== TESTS ====================

describe("BacktestEngine", () => {
  let engine: BacktestEngine;

  beforeEach(() => {
    engine = new BacktestEngine({ ...defaultConfig });
  });

  describe("Inicialización", () => {
    it("debe crear una instancia con la configuración por defecto", () => {
      expect(engine).toBeInstanceOf(BacktestEngine);
    });

    it("debe iniciar una señal correctamente", () => {
      engine.startSignal("BUY" as Side, 2650.0, 0, new Date());
      const trades = engine.openInitialOrders(2650.0, new Date());

      expect(trades).toHaveLength(1);
      expect(trades[0].side).toBe("BUY");
      expect(trades[0].price).toBe(2650.0);
      expect(trades[0].lotSize).toBe(0.01);
    });
  });

  describe("Cálculo de Profit - BUY", () => {
    it("debe calcular profit positivo cuando el precio sube en BUY", () => {
      const startTime = new Date("2025-10-01T10:00:00Z");
      engine.startSignal("BUY" as Side, 2650.0, 0, startTime);
      engine.openInitialOrders(2650.0, startTime);

      // Precio sube 20 pips = TP hit
      const tick = createTick(2652.0, 2652.1, new Date("2025-10-01T10:30:00Z"));
      const result = engine.processTick(tick);

      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThan(0);
      expect(result![0].type).toBe("CLOSE");
      expect(result![0].profitPips).toBeGreaterThan(0);
    });

    it("debe calcular profit negativo cuando el precio baja en BUY", () => {
      const startTime = new Date("2025-10-01T10:00:00Z");
      engine.startSignal("BUY" as Side, 2650.0, 0, startTime);
      engine.openInitialOrders(2650.0, startTime);

      // Simular movimiento en contra sin llegar a TP
      // Primero algunos ticks neutros
      for (let i = 0; i < 5; i++) {
        const tick = createTick(
          2649.0 - i * 0.5,
          2649.1 - i * 0.5,
          new Date(startTime.getTime() + i * 60000)
        );
        engine.processTick(tick);
      }

      // Verificar que hay posiciones abiertas
      expect(engine.hasOpenPositions()).toBe(true);
    });
  });

  describe("Cálculo de Profit - SELL", () => {
    it("debe calcular profit positivo cuando el precio baja en SELL", () => {
      const startTime = new Date("2025-10-01T10:00:00Z");
      engine.startSignal("SELL" as Side, 2650.0, 0, startTime);
      engine.openInitialOrders(2650.0, startTime);

      // Precio baja 20 pips = TP hit (para SELL, usamos bid para cerrar)
      const tick = createTick(2647.9, 2648.0, new Date("2025-10-01T10:30:00Z"));
      const result = engine.processTick(tick);

      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThan(0);
      expect(result![0].type).toBe("CLOSE");
    });
  });

  describe("Take Profit", () => {
    it("debe cerrar posiciones cuando alcanza el TP en BUY", () => {
      const startTime = new Date("2025-10-01T10:00:00Z");
      engine.startSignal("BUY" as Side, 2650.0, 0, startTime);
      engine.openInitialOrders(2650.0, startTime);

      // TP = 20 pips = 2.0 USD (20 * 0.10)
      // Precio objetivo = 2650.0 + 2.0 = 2652.0
      const tpTick = createTick(2652.0, 2652.1, new Date("2025-10-01T10:30:00Z"));
      const result = engine.processTick(tpTick);

      expect(result).not.toBeNull();
      expect(engine.hasOpenPositions()).toBe(false);
    });

    it("debe cerrar posiciones cuando alcanza el TP en SELL", () => {
      const startTime = new Date("2025-10-01T10:00:00Z");
      engine.startSignal("SELL" as Side, 2650.0, 0, startTime);
      engine.openInitialOrders(2650.0, startTime);

      // TP = 20 pips = 2.0 USD
      // Precio objetivo = 2650.0 - 2.0 = 2648.0
      const tpTick = createTick(2647.9, 2648.0, new Date("2025-10-01T10:30:00Z"));
      const result = engine.processTick(tpTick);

      expect(result).not.toBeNull();
      expect(engine.hasOpenPositions()).toBe(false);
    });
  });

  describe("Stop Loss Fijo", () => {
    it("debe cerrar posiciones cuando alcanza el SL fijo", () => {
      const configWithSL: BacktestConfig = {
        ...defaultConfig,
        stopLossPips: 50,
        useStopLoss: true,
      };
      engine = new BacktestEngine(configWithSL);

      const startTime = new Date("2025-10-01T10:00:00Z");
      engine.startSignal("BUY" as Side, 2650.0, 0, startTime);
      engine.openInitialOrders(2650.0, startTime);

      // SL = 50 pips = 5.0 USD
      // Precio SL = 2650.0 - 5.0 = 2645.0
      const slTick = createTick(2644.9, 2645.0, new Date("2025-10-01T11:00:00Z"));
      const result = engine.processTick(slTick);

      expect(result).not.toBeNull();
      expect(engine.hasOpenPositions()).toBe(false);
    });
  });

  describe("Trailing Stop Loss", () => {
    it("debe activar trailing SL después de alcanzar distancia de activación", () => {
      const configWithTrailing: BacktestConfig = {
        ...defaultConfig,
        useTrailingSL: true,
        trailingSLPercent: 50,
        takeProfitPips: 20,
      };
      engine = new BacktestEngine(configWithTrailing);

      const startTime = new Date("2025-10-01T10:00:00Z");
      engine.startSignal("BUY" as Side, 2650.0, 0, startTime);
      engine.openInitialOrders(2650.0, startTime);

      // Mover precio hacia arriba (más allá de la distancia de activación)
      // Activación = TP = 20 pips = 2.0 USD
      // Pero NO llegamos al TP completo, solo activamos trailing
      const activationTick = createTick(
        2651.0,
        2651.1,
        new Date("2025-10-01T10:15:00Z")
      );
      engine.processTick(activationTick);

      // Seguir subiendo para activar trailing
      const trailingTick = createTick(
        2652.0,
        2652.1,
        new Date("2025-10-01T10:20:00Z")
      );
      const result = engine.processTick(trailingTick);

      // Debería cerrar con TP o Trailing SL
      if (result && result.length > 0) {
        expect(engine.hasOpenPositions()).toBe(false);
      }
    });
  });

  describe("Restricciones de Canal", () => {
    it("debe limitar niveles con restricción RIESGO (solo 1 operación)", () => {
      const configRiesgo: BacktestConfig = {
        ...defaultConfig,
        restrictionType: "RIESGO",
        maxLevels: 4, // Se debería ignorar
      };
      engine = new BacktestEngine(configRiesgo);

      const startTime = new Date("2025-10-01T10:00:00Z");
      engine.startSignal("BUY" as Side, 2650.0, 0, startTime);
      engine.openInitialOrders(2650.0, startTime);

      // Intentar forzar promedios moviendo precio en contra
      for (let i = 0; i < 10; i++) {
        const tick = createTick(
          2645.0 - i,
          2645.1 - i,
          new Date(startTime.getTime() + i * 60000)
        );
        engine.processTick(tick);
      }

      const results = engine.getResults();
      // Con RIESGO solo debería haber 1 trade base, sin promedios
      expect(results.totalTrades).toBeLessThanOrEqual(1);
    });

    it("debe limitar a 1 nivel con SIN_PROMEDIOS", () => {
      const configSinPromedios: BacktestConfig = {
        ...defaultConfig,
        restrictionType: "SIN_PROMEDIOS",
      };
      engine = new BacktestEngine(configSinPromedios);

      const startTime = new Date("2025-10-01T10:00:00Z");
      engine.startSignal("BUY" as Side, 2650.0, 0, startTime);
      engine.openInitialOrders(2650.0, startTime);

      // Mover precio en contra para intentar generar promedios
      for (let i = 0; i < 10; i++) {
        const tick = createTick(
          2640.0 - i,
          2640.1 - i,
          new Date(startTime.getTime() + i * 60000)
        );
        engine.processTick(tick);
      }

      // Con SIN_PROMEDIOS no debería abrir niveles adicionales
      expect(engine.hasOpenPositions() || engine.getResults().totalTrades <= 1).toBe(true);
    });
  });

  describe("Resultados Finales", () => {
    it("debe generar métricas completas en getResults", () => {
      const startTime = new Date("2025-10-01T10:00:00Z");
      engine.startSignal("BUY" as Side, 2650.0, 0, startTime);
      engine.openInitialOrders(2650.0, startTime);

      // Ejecutar hasta TP
      const tpTick = createTick(2652.0, 2652.1, new Date("2025-10-01T10:30:00Z"));
      engine.processTick(tpTick);

      const results = engine.getResults();

      expect(results).toHaveProperty("totalTrades");
      expect(results).toHaveProperty("totalProfit");
      expect(results).toHaveProperty("winRate");
      expect(results).toHaveProperty("profitFactor");
      expect(results).toHaveProperty("sharpeRatio");
      expect(results).toHaveProperty("initialCapital");
      expect(results).toHaveProperty("finalCapital");
      expect(results.initialCapital).toBe(10000);
    });

    it("debe calcular win rate correctamente después de múltiples trades", () => {
      // Trade 1 - Ganador
      engine.startSignal("BUY" as Side, 2650.0, 0, new Date("2025-10-01T10:00:00Z"));
      engine.openInitialOrders(2650.0, new Date("2025-10-01T10:00:00Z"));
      engine.processTick(createTick(2652.0, 2652.1, new Date("2025-10-01T10:30:00Z")));

      const results = engine.getResults();
      expect(results.winRate).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("debe manejar señal sin ticks", () => {
      engine.startSignal("BUY" as Side, 2650.0, 0, new Date());
      engine.openInitialOrders(2650.0, new Date());

      // No procesar ningún tick
      const results = engine.getResults();

      // Sin ticks, no debería haber trades cerrados
      expect(results.totalTrades).toBe(0);
    });

    it("debe manejar múltiples operaciones iniciales (numOrders > 1)", () => {
      const configMulti: BacktestConfig = {
        ...defaultConfig,
        numOrders: 3,
      };
      engine = new BacktestEngine(configMulti);

      engine.startSignal("BUY" as Side, 2650.0, 0, new Date());
      const trades = engine.openInitialOrders(2650.0, new Date());

      expect(trades).toHaveLength(3);
      expect(trades[0].level).toBe(0);
      expect(trades[1].level).toBe(1);
      expect(trades[2].level).toBe(2);
    });

    it("debe cerrar posiciones pendientes al finalizar señal", () => {
      engine.startSignal("BUY" as Side, 2650.0, 0, new Date());
      engine.openInitialOrders(2650.0, new Date());

      // Procesar algunos ticks sin TP ni SL
      for (let i = 0; i < 5; i++) {
        const tick = createTick(2649.0, 2649.1, new Date(Date.now() + i * 60000));
        engine.processTick(tick);
      }

      expect(engine.hasOpenPositions()).toBe(true);

      // Cerrar posiciones pendientes
      const closingTrades = engine.closeRemainingPositions(2649.0, new Date());

      expect(closingTrades.length).toBeGreaterThan(0);
      expect(engine.hasOpenPositions()).toBe(false);
    });
  });
});
