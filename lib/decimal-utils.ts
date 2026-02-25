/**
 * Utilidades para precisión financiera con Decimal.js
 *
 * IMPORTANTE: En trading, los errores de punto flotante pueden causar
 * discrepancias significativas en backtests largos.
 *
 * Ejemplo del problema:
 *   0.1 + 0.2 = 0.30000000000000004 (float)
 *   0.1 + 0.2 = 0.3 (Decimal)
 *
 * Usar Decimal para:
 * - Cálculos de profit/loss
 * - Precios de entrada/salida
 * - Pips y distancias
 */

import Decimal from "decimal.js";

// Configuración para trading financiero
Decimal.set({
  precision: 20, // Suficiente para la mayoría de activos
  rounding: Decimal.ROUND_HALF_UP,
});

/**
 * Wrapper tipado para operaciones financieras comunes
 */
export const Finance = {
  /**
   * Crea un Decimal desde un número o string
   */
  from(value: number | string | Decimal): Decimal {
    return new Decimal(value);
  },

  /**
   * Suma dos valores
   */
  add(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    return new Decimal(a).plus(b);
  },

  /**
   * Resta dos valores
   */
  sub(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    return new Decimal(a).minus(b);
  },

  /**
   * Multiplica dos valores
   */
  mul(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    return new Decimal(a).times(b);
  },

  /**
   * Divide dos valores
   */
  div(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    return new Decimal(a).dividedBy(b);
  },

  /**
   * Valor absoluto
   */
  abs(value: number | string | Decimal): Decimal {
    return new Decimal(value).abs();
  },

  /**
   * Compara si a >= b
   */
  gte(a: number | string | Decimal, b: number | string | Decimal): boolean {
    return new Decimal(a).gte(b);
  },

  /**
   * Compara si a <= b
   */
  lte(a: number | string | Decimal, b: number | string | Decimal): boolean {
    return new Decimal(a).lte(b);
  },

  /**
   * Compara si a > b
   */
  gt(a: number | string | Decimal, b: number | string | Decimal): boolean {
    return new Decimal(a).gt(b);
  },

  /**
   * Compara si a < b
   */
  lt(a: number | string | Decimal, b: number | string | Decimal): boolean {
    return new Decimal(a).lt(b);
  },

  /**
   * Convierte a número (usar solo para output final)
   */
  toNumber(value: Decimal): number {
    return value.toNumber();
  },

  /**
   * Redondea a N decimales
   */
  round(value: number | string | Decimal, decimals: number = 2): Decimal {
    return new Decimal(value).toDecimalPlaces(decimals);
  },

  /**
   * Calcula profit en pips para XAUUSD
   * @param entryPrice Precio de entrada
   * @param exitPrice Precio de salida
   * @param side "BUY" o "SELL"
   * @param pipValue Valor de 1 pip (default 0.10 para XAUUSD)
   */
  calculatePips(
    entryPrice: number | string | Decimal,
    exitPrice: number | string | Decimal,
    side: "BUY" | "SELL",
    pipValue: number = 0.10
  ): Decimal {
    const entry = new Decimal(entryPrice);
    const exit = new Decimal(exitPrice);
    const pip = new Decimal(pipValue);

    if (side === "BUY") {
      // BUY: profit = (exit - entry) / pipValue
      return exit.minus(entry).dividedBy(pip);
    } else {
      // SELL: profit = (entry - exit) / pipValue
      return entry.minus(exit).dividedBy(pip);
    }
  },

  /**
   * Calcula profit en dinero
   * @param profitPips Profit en pips
   * @param lotSize Tamaño del lote
   * @param pipValue Valor de 1 pip por lote (default 0.10 para XAUUSD)
   */
  calculateProfit(
    profitPips: number | string | Decimal,
    lotSize: number | string | Decimal,
    pipValue: number = 0.10
  ): Decimal {
    const pips = new Decimal(profitPips);
    const lots = new Decimal(lotSize);
    const pip = new Decimal(pipValue);

    // profit = pips * lots / pipValue
    return pips.times(lots).dividedBy(pip);
  },

  /**
   * Calcula precio promedio ponderado
   * @param positions Array de { price, lotSize }
   */
  calculateAveragePrice(
    positions: Array<{ price: number | string | Decimal; lotSize: number | string | Decimal }>
  ): Decimal | null {
    if (positions.length === 0) return null;

    let totalLots = new Decimal(0);
    let weightedSum = new Decimal(0);

    for (const pos of positions) {
      const price = new Decimal(pos.price);
      const lots = new Decimal(pos.lotSize);
      totalLots = totalLots.plus(lots);
      weightedSum = weightedSum.plus(price.times(lots));
    }

    if (totalLots.isZero()) return null;

    return weightedSum.dividedBy(totalLots);
  },
};

export { Decimal };
export default Finance;
