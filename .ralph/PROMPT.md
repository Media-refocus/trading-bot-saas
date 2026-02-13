# PROMPT - Ralph Loop Trading Bot SaaS

## Contexto
Backtester con ticks reales funcionando. Objetivo: encontrar las mejores estrategias de grid-scalping con gestión de riesgo dinámica.

## Capital base: $10,000

---

## 30 ESTRATEGIAS A PROBAR

### GRUPO 1: Grid Básico (variando distancias)
| # | Nombre | pipsDistance | maxLevels | takeProfitPips | lotajeBase |
|---|--------|--------------|-----------|-----------------|------------|
| 1 | GRID_8 | 8 | 35 | 8 | 0.03 |
| 2 | GRID_10 | 10 | 30 | 10 | 0.03 |
| 3 | GRID_12 | 12 | 25 | 12 | 0.03 |
| 4 | GRID_15 | 15 | 20 | 15 | 0.03 |
| 5 | GRID_20 | 20 | 15 | 20 | 0.03 |

### GRUPO 2: Grid con Stop Loss (gestión de riesgo)
| # | Nombre | pipsDistance | maxLevels | TP | SL | lotaje |
|---|--------|--------------|-----------|-----|-----|--------|
| 6 | GRID_SL_50 | 12 | 25 | 12 | 50 | 0.03 |
| 7 | GRID_SL_100 | 12 | 25 | 12 | 100 | 0.03 |
| 8 | GRID_SL_200 | 12 | 25 | 12 | 200 | 0.03 |
| 9 | GRID_SL_DINAMICO | 10 | 30 | 10 | 150 | 0.02 |
| 10 | GRID_TRAILING | 12 | 25 | 0 | 0 | 0.03 |

### GRUPO 3: Multi-Order (varias órdenes por nivel)
| # | Nombre | numOrders | pipsDistance | maxLevels | lotaje |
|---|--------|-----------|--------------|-----------|--------|
| 11 | MULTI_2 | 2 | 12 | 20 | 0.02 |
| 12 | MULTI_3 | 3 | 12 | 15 | 0.015 |
| 13 | MULTI_2_TIGHT | 2 | 8 | 25 | 0.02 |
| 14 | MULTI_3_TIGHT | 3 | 8 | 20 | 0.015 |

### GRUPO 4: Scalping (TP pequeño, muchas operaciones)
| # | Nombre | pipsDistance | TP | maxLevels | SL |
|---|--------|--------------|-----|-----------|-----|
| 15 | SCALP_5 | 5 | 5 | 40 | 30 |
| 16 | SCALP_8 | 8 | 8 | 35 | 40 |
| 17 | SCALP_AGRESIVO | 5 | 5 | 50 | 0 |

### GRUPO 5: Swing (TP grande, aguantar movimiento)
| # | Nombre | pipsDistance | TP | maxLevels | SL |
|---|--------|--------------|-----|-----------|-----|
| 18 | SWING_20 | 15 | 20 | 20 | 100 |
| 19 | SWING_30 | 20 | 30 | 15 | 150 |
| 20 | SWING_50 | 25 | 50 | 12 | 200 |

### GRUPO 6: Promedios Inteligentes (estrategias nuevas)
| # | Nombre | Descripción |
|---|--------|-------------|
| 21 | SMART_CLOSE_BASE | Cierra nivel 0 cuando promedios en profit, reabre más abajo |
| 22 | SMART_COMPENSATE | Usa profits acumulados para cerrar posiciones lejanas en pérdida |
| 23 | SMART_REENTRY | Solo reabre si profit acumulado del día > 0 |
| 24 | SMART_DYNAMIC_DIST | Distancia de grid = 8 si profit > 0, 15 si profit < 0 |
| 25 | SMART_RISK_MGMT | Reduce lotaje 50% si DD > 5%, aumenta si DD < 2% |

### GRUPO 7: Conservadoras (bajo riesgo)
| # | Nombre | pipsDistance | maxLevels | TP | SL | lotaje |
|---|--------|--------------|-----------|-----|-----|--------|
| 26 | CONSERV_5 | 15 | 10 | 20 | 50 | 0.02 |
| 27 | CONSERV_10 | 20 | 8 | 25 | 60 | 0.02 |
| 28 | CONSERV_PROM | 15 | 5 | 30 | 40 | 0.025 |

### GRUPO 8: Agresivas (alto riesgo/recompensa)
| # | Nombre | pipsDistance | maxLevels | TP | SL | lotaje |
|---|--------|--------------|-----------|-----|-----|--------|
| 29 | AGRESIVO_1 | 8 | 40 | 8 | 0 | 0.04 |
| 30 | AGRESIVO_2 | 10 | 35 | 10 | 200 | 0.05 |

---

## ORDEN DE EJECUCIÓN

### FASE 1: Ejecutar las 30 estrategias
1-30. EJECUTAR cada estrategia y guardar resultado en `backtest_results/estrategia_{numero}_{nombre}.json`

### FASE 2: Compilar resultados
31. GUARDAR `backtest_results/strategies_comparison.json` con todas las estrategias
32. GENERAR `backtest_results/ranking_profit.md`
33. GENERAR `backtest_results/ranking_winrate.md`
34. GENERAR `backtest_results/ranking_drawdown.md`
35. GENERAR `backtest_results/ranking_profit_factor.md`
36. GENERAR `backtest_results/MEJOR_ESTRATEGIA.md`

### FASE 3: Análisis adicional
37. GENERAR `backtest_results/analisis_por_grupo.md` (comparar grupos)
38. GENERAR `backtest_results/recomendaciones.md` (estrategias por perfil de riesgo)

---

## COMANDO BASE PARA EJECUTAR

```bash
curl -X POST "http://localhost:3000/api/trpc/backtester.execute?batch=1" \
  -H "Content-Type: application/json" \
  -d '{"0":{"json":{"config":{"strategyName":"GRID_12","lotajeBase":0.03,"numOrders":1,"pipsDistance":12,"maxLevels":25,"takeProfitPips":12,"useStopLoss":false,"signalsSource":"signals_parsed.csv","useRealPrices":true},"signalLimit":154}}}'
```

---

## FORMATO DE RESULTADO

```json
{
  "strategyName": "GRID_12",
  "grupo": "GRID_BASICO",
  "config": { ... },
  "results": {
    "totalTrades": N,
    "totalProfit": N,
    "totalProfitPips": N,
    "winRate": N,
    "maxDrawdown": N,
    "profitFactor": N
  },
  "timestamp": "ISO_DATE"
}
```

---

## REGLAS
- Una estrategia = un commit
- signalLimit: 154 (todas las señales)
- signalsSource: "signals_parsed.csv"
- useRealPrices: true
- Capital inicial: $10,000 (en el motor)
- Si hay error, fixear y continuar
- Al completar las 38 tareas, responder: RALPH_COMPLETE
