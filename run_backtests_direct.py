#!/usr/bin/env python3
"""
Ejecutar backtests directamente sin servidor HTTP
Usa el motor de backtest directamente para mayor velocidad
"""

import csv
import json
import sys
from datetime import datetime
from pathlib import Path

# Añadir el directorio del proyecto al path
sys.path.insert(0, str(Path(__file__).parent))

# Importar componentes del backtest
from lib.backtest_engine import BacktestEngine, BacktestConfig
from lib.parsers.signals_csv import parseSignalsCsv, groupSignalsByRange
from lib.parsers.ticks_loader import enrichSignalsWithRealPrices, hasTicksData

# Configuración
SIGNAL_FILE = "signals_intradia.csv"
SIGNAL_LIMIT = 50  # Empezar con 50 para que sea rápido
INITIAL_CAPITAL = 10000
RESULTS_DIR = Path("backtest_results_intradia")

# 30 Estrategias
STRATEGIES = [
    {"name": "GRID_8", "grupo": "GRID_BASICO", "config": {"pipsDistance": 8, "maxLevels": 35, "takeProfitPips": 8, "lotajeBase": 0.03, "numOrders": 1, "useStopLoss": False}},
    {"name": "GRID_10", "grupo": "GRID_BASICO", "config": {"pipsDistance": 10, "maxLevels": 30, "takeProfitPips": 10, "lotajeBase": 0.03, "numOrders": 1, "useStopLoss": False}},
    {"name": "GRID_12", "grupo": "GRID_BASICO", "config": {"pipsDistance": 12, "maxLevels": 25, "takeProfitPips": 12, "lotajeBase": 0.03, "numOrders": 1, "useStopLoss": False}},
    {"name": "GRID_15", "grupo": "GRID_BASICO", "config": {"pipsDistance": 15, "maxLevels": 20, "takeProfitPips": 15, "lotajeBase": 0.03, "numOrders": 1, "useStopLoss": False}},
    {"name": "GRID_20", "grupo": "GRID_BASICO", "config": {"pipsDistance": 20, "maxLevels": 15, "takeProfitPips": 20, "lotajeBase": 0.03, "numOrders": 1, "useStopLoss": False}},
    {"name": "GRID_SL_50", "grupo": "GRID_SL", "config": {"pipsDistance": 8, "maxLevels": 35, "takeProfitPips": 8, "lotajeBase": 0.03, "numOrders": 1, "useStopLoss": True, "stopLossPips": 50}},
    {"name": "GRID_SL_100", "grupo": "GRID_SL", "config": {"pipsDistance": 8, "maxLevels": 35, "takeProfitPips": 8, "lotajeBase": 0.03, "numOrders": 1, "useStopLoss": True, "stopLossPips": 100}},
    {"name": "GRID_SL_200", "grupo": "GRID_SL", "config": {"pipsDistance": 8, "maxLevels": 35, "takeProfitPips": 8, "lotajeBase": 0.03, "numOrders": 1, "useStopLoss": True, "stopLossPips": 200}},
    {"name": "GRID_SL_DIN", "grupo": "GRID_SL", "config": {"pipsDistance": 8, "maxLevels": 35, "takeProfitPips": 8, "lotajeBase": 0.03, "numOrders": 1, "useStopLoss": True, "stopLossPips": 150}},
    {"name": "MULTI_2", "grupo": "MULTI_ORDER", "config": {"pipsDistance": 10, "maxLevels": 25, "takeProfitPips": 10, "lotajeBase": 0.02, "numOrders": 2, "useStopLoss": False}},
    {"name": "MULTI_3", "grupo": "MULTI_ORDER", "config": {"pipsDistance": 12, "maxLevels": 20, "takeProfitPips": 12, "lotajeBase": 0.02, "numOrders": 3, "useStopLoss": False}},
    {"name": "MULTI_2_TIGHT", "grupo": "MULTI_ORDER", "config": {"pipsDistance": 6, "maxLevels": 40, "takeProfitPips": 6, "lotajeBase": 0.02, "numOrders": 2, "useStopLoss": False}},
    {"name": "MULTI_3_TIGHT", "grupo": "MULTI_ORDER", "config": {"pipsDistance": 8, "maxLevels": 35, "takeProfitPips": 8, "lotajeBase": 0.02, "numOrders": 3, "useStopLoss": False}},
    {"name": "SCALP_5", "grupo": "SCALPING", "config": {"pipsDistance": 5, "maxLevels": 45, "takeProfitPips": 5, "lotajeBase": 0.03, "numOrders": 1, "useStopLoss": False}},
    {"name": "SCALP_8", "grupo": "SCALPING", "config": {"pipsDistance": 8, "maxLevels": 35, "takeProfitPips": 8, "lotajeBase": 0.03, "numOrders": 1, "useStopLoss": False}},
    {"name": "SCALP_AGR", "grupo": "SCALPING", "config": {"pipsDistance": 5, "maxLevels": 50, "takeProfitPips": 5, "lotajeBase": 0.04, "numOrders": 1, "useStopLoss": False}},
    {"name": "SWING_20", "grupo": "SWING", "config": {"pipsDistance": 20, "maxLevels": 15, "takeProfitPips": 20, "lotajeBase": 0.03, "numOrders": 1, "useStopLoss": False}},
    {"name": "SWING_30", "grupo": "SWING", "config": {"pipsDistance": 30, "maxLevels": 12, "takeProfitPips": 30, "lotajeBase": 0.03, "numOrders": 1, "useStopLoss": False}},
    {"name": "SWING_50", "grupo": "SWING", "config": {"pipsDistance": 50, "maxLevels": 10, "takeProfitPips": 50, "lotajeBase": 0.03, "numOrders": 1, "useStopLoss": False}},
    {"name": "SMART_BASE", "grupo": "SMART", "config": {"pipsDistance": 8, "maxLevels": 35, "takeProfitPips": 8, "lotajeBase": 0.03, "numOrders": 1, "useStopLoss": False}},
    {"name": "SMART_COMP", "grupo": "SMART", "config": {"pipsDistance": 8, "maxLevels": 35, "takeProfitPips": 8, "lotajeBase": 0.03, "numOrders": 1, "useStopLoss": False}},
    {"name": "SMART_REENTRY", "grupo": "SMART", "config": {"pipsDistance": 8, "maxLevels": 35, "takeProfitPips": 8, "lotajeBase": 0.03, "numOrders": 1, "useStopLoss": False}},
    {"name": "SMART_DYN", "grupo": "SMART", "config": {"pipsDistance": 8, "maxLevels": 35, "takeProfitPips": 8, "lotajeBase": 0.03, "numOrders": 1, "useStopLoss": False}},
    {"name": "SMART_RISK", "grupo": "SMART", "config": {"pipsDistance": 8, "maxLevels": 35, "takeProfitPips": 8, "lotajeBase": 0.03, "numOrders": 1, "useStopLoss": False}},
    {"name": "CONSERV_5", "grupo": "CONSERVADOR", "config": {"pipsDistance": 15, "maxLevels": 10, "takeProfitPips": 15, "lotajeBase": 0.01, "numOrders": 1, "useStopLoss": True, "stopLossPips": 100}},
    {"name": "CONSERV_10", "grupo": "CONSERVADOR", "config": {"pipsDistance": 20, "maxLevels": 8, "takeProfitPips": 20, "lotajeBase": 0.01, "numOrders": 1, "useStopLoss": True, "stopLossPips": 80}},
    {"name": "CONSERV_PROM", "grupo": "CONSERVADOR", "config": {"pipsDistance": 25, "maxLevels": 6, "takeProfitPips": 25, "lotajeBase": 0.01, "numOrders": 1, "useStopLoss": True, "stopLossPips": 60}},
    {"name": "AGRESIVO_1", "grupo": "AGRESIVO", "config": {"pipsDistance": 8, "maxLevels": 40, "takeProfitPips": 8, "lotajeBase": 0.04, "numOrders": 1, "useStopLoss": False}},
    {"name": "AGRESIVO_2", "grupo": "AGRESIVO", "config": {"pipsDistance": 6, "maxLevels": 45, "takeProfitPips": 6, "lotajeBase": 0.05, "numOrders": 1, "useStopLoss": False}},
]

def load_signals(filepath: str, limit: int = None):
    """Carga señales desde CSV"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    raw_signals = parseSignalsCsv(content)
    trading_signals = groupSignalsByRange(raw_signals)

    if limit:
        trading_signals = trading_signals[:limit]

    return trading_signals

def run_backtest(signals, config_dict):
    """Ejecuta un backtest con la configuración dada"""
    # Crear configuración
    config = BacktestConfig(
        strategyName=config_dict.get("name", "Test"),
        lotajeBase=config_dict.get("lotajeBase", 0.03),
        numOrders=config_dict.get("numOrders", 1),
        pipsDistance=config_dict.get("pipsDistance", 10),
        maxLevels=config_dict.get("maxLevels", 4),
        takeProfitPips=config_dict.get("takeProfitPips", 20),
        stopLossPips=config_dict.get("stopLossPips", 0),
        useStopLoss=config_dict.get("useStopLoss", False),
    )

    # Crear engine
    engine = BacktestEngine(config)

    # Simular cada señal con ticks sintéticos (más rápido)
    for signal in signals:
        engine.startSignal(signal.side, signal.entryPrice)
        engine.openInitialOrders(signal.entryPrice)

        # Generar ticks sintéticos
        duration_ms = 30 * 60 * 1000  # 30 min
        if signal.closeTimestamp:
            duration_ms = max(60000, signal.closeTimestamp.timestamp() - signal.timestamp.timestamp())

        # Simular movimiento de precio
        num_ticks = 100
        for i in range(num_ticks):
            progress = i / num_ticks
            noise = (hash(f"{signal.id}{i}") % 100 - 50) / 500  # Ruido determinista
            tick_price = signal.entryPrice * (1 + noise * 0.001)

            tick = {
                "timestamp": signal.timestamp,
                "bid": tick_price,
                "ask": tick_price + 0.1,
                "spread": 0.1
            }
            engine.processTick(tick)

    return engine.getResults()

def main():
    print("=== BACKTESTS DIRECTOS CON SEÑALES INTRADÍA ===")
    print(f"Archivo: {SIGNAL_FILE}")
    print(f"Límite: {SIGNAL_LIMIT} señales")
    print(f"Estrategias: {len(STRATEGIES)}")
    print()

    # Crear directorio de resultados
    RESULTS_DIR.mkdir(exist_ok=True)

    # Cargar señales
    print("Cargando señales...")
    signals = load_signals(SIGNAL_FILE, SIGNAL_LIMIT)
    print(f"Cargadas {len(signals)} señales")
    print()

    # Ejecutar cada estrategia
    all_results = []

    for i, strategy in enumerate(STRATEGIES, 1):
        name = strategy["name"]
        grupo = strategy["grupo"]
        config = strategy["config"]

        print(f"[{i}/{len(STRATEGIES)}] {name}...", end=" ", flush=True)

        try:
            results = run_backtest(signals, config)
            print(f"OK - Trades: {results.totalTrades}, Profit: ${results.totalProfit:.2f}, DD: ${results.maxDrawdown:.2f}")

            # Guardar resultado individual
            result_file = RESULTS_DIR / f"{name}.json"
            with open(result_file, 'w') as f:
                json.dump({
                    "name": name,
                    "grupo": grupo,
                    "config": config,
                    "results": {
                        "totalProfit": results.totalProfit,
                        "totalTrades": results.totalTrades,
                        "maxDrawdown": results.maxDrawdown,
                        "profitableTrades": results.profitableTrades,
                    }
                }, f, indent=2)

            all_results.append({
                "name": name,
                "grupo": grupo,
                "profit": results.totalProfit,
                "trades": results.totalTrades,
                "maxDD": results.maxDrawdown,
            })

        except Exception as e:
            print(f"ERROR: {e}")

    # Ranking
    print()
    print("=== RANKING POR PROFIT ===")
    all_results.sort(key=lambda x: x["profit"], reverse=True)

    ranking_file = RESULTS_DIR / "ranking.md"
    with open(ranking_file, 'w') as f:
        f.write(f"# Ranking por Profit ({SIGNAL_LIMIT} señales, ticks sintéticos)\n\n")
        f.write("| Pos | Estrategia | Grupo | Profit | Trades | Max DD |\n")
        f.write("|-----|-----------|-------|--------|--------|--------|\n")

        for i, r in enumerate(all_results, 1):
            print(f"{i:2d}. {r['name']:15s} | {r['grupo']:12s} | ${r['profit']:8.2f} | {r['trades']:5d} | ${r['maxDD']:8.2f}")
            f.write(f"| {i} | {r['name']} | {r['grupo']} | ${r['profit']:.2f} | {r['trades']} | ${r['maxDD']:.2f} |\n")

    print()
    print(f"Resultados guardados en: {RESULTS_DIR}")

if __name__ == "__main__":
    main()
