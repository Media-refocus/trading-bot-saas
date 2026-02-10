# Resumen - Backtester Xisco (Vikingo Trading)

> Fecha: 2026-02-10
> Estado: ✅ EAs creados y listos para testing

---

## 📋 Resumen Ejecutivo

Se han analizado la **Guía Operativa Vikingo Trading** y creado **3 EAs de backtesting** adaptados a la operativa real de Xisco, basándose en las diferentes guías según capital del trader.

---

## 📁 Archivos Creados

### 1. Análisis de la Guía Operativa
**`docs/ANALISIS_GUIA_OPERATIVA_VIKINGO.md`**
- Análisis completo de la filosofía de trading de Vikingo Trading
- Parámetros de cada guía (G1-G5)
- Diferencias con EA de Toni
- Recomendaciones para backtesting

### 2. EAs de Backtesting

#### 📘 **Backtester_Xisco_G2.mq5** - Guía 2 ($250-$500)
```
Lote Base: 0.01
Distancia Promedios: 30 pips
Niveles Máximos: 4 (1 base + 3)
SL Mental: 250 pips
TP: +20 pips (cierre total)
```
**Características:**
- Grid simple de distancia fija (30 pips)
- Sin trailing complejo
- Cierre total al alcanzar +20 pips
- Output: `ranges_G2.csv`

#### 📙 **Backtester_Xisco_G4.mq5** - Guía 4 ($1,000-$1,500)
```
Lote Base: 0.01 (o 0.02*)
Distancia Promedios: 20 pips
Niveles Máximos: 4 (1 base + 3)
SL Mental: 300 pips
TP: +20 pips (cierre parcial 50%) + BE
```
**Características:**
- Grid más agresivo (20 pips)
- Cierre parcial 50% en +20 pips
- Mover SL a Break-Even en +20
- Opción de 2 operaciones desde el inicio (`InpDualOperations`)
- Output: `ranges_G4.csv`

#### 🔴 **Backtester_Xisco_Restrictions.mq5** - Con Restricciones
```
Default: 4 niveles (1 base + 3)
SL Mental: 300 pips
TP: +20 pips + BE
```
**Características:**
- **Detección automática de restricciones** del canal:
  * `RIESGO` → 2 niveles (1 base + 1 promedio)
  * `SIN PROMEDIOS` → 1 nivel (solo base)
  * `SOLO 1 PROMEDIO` → 2 niveles (1 base + 1)
- Parsea campo `confidence` del CSV
- Logging de restricciones detectadas
- Colores en gráfico según restricción
- Output: `ranges_Restrictions.csv`

---

## 🔄 Diferencias Clave con EA de Toni

| Aspecto | Toni | Xisco G2/G4 | Xisco Restrictions |
|---------|------|-------------|-------------------|
| **Max Niveles** | 40 | 4 | Variable (1-4) |
| **Grid** | Variable schedule | Fija (20/30 pips) | Fija |
| **S00 Scalper** | ✅ +20 pips | ❌ No | ❌ No |
| **Trailing L00** | Genérico | No | No |
| **SL** | Trailing | Mental fijo | Mental fijo |
| **TP** | S00 +20 | Total/Parcial + BE | Parcial + BE |
| **Restricciones** | No | No | ✅ Sí |
| **Lotes** | 0.03 | 0.01 | 0.01 |
| **Filosofía** | Grid agresivo | Conservador | Adaptativo |

---

## 📊 Outputs de Backtesting

### Archivos CSV Generados

**ranges_G2.csv**
```csv
range_id;side;open_ts;close_ts;mfe_pips;mae_pips;pnl_total_pips;max_levels
```

**ranges_G4.csv**
```csv
range_id;side;open_ts;close_ts;mfe_pips;mae_pips;pnl_total_pips;max_levels;tp_hit
```

**ranges_Restrictions.csv**
```csv
range_id;side;open_ts;close_ts;mfe_pips;mae_pips;pnl_total_pips;max_levels;restriction;tp_hit
```

### Métricas Clave
- **Win Rate**: % de rangos en verde
- **MFE** (Maximum Favorable Excursion): Máximo pips a favor
- **MAE** (Maximum Adverse Excursion): Máximo pips en contra
- **Avg Drawdown**: Drawdown promedio por rango
- **Max Levels Used**: Máximo nivel de promedio alcanzado
- **PnL per Range**: Beneficio/pérdida promedio

---

## 🚀 Próximos Pasos

### 1. Copiar EAs a MT5
```
Copiar archivos .mq5 a:
C:\Users\guill\AppData\Roaming\MetaQuotes\Terminal\[HASH]\MQL5\Experts\
```

### 2. Copiar CSV de señales
```
Copiar signals_simple.csv a:
C:\Users\guill\AppData\Roaming\MetaQuotes\Terminal\[HASH]\MQL5\Files\
```

### 3. Configurar Strategy Tester
- **Símbolo**: XAUUSD (Gold)
- **Modelo**: "Every tick" o "Open prices only"
- **Periodo**: M1 o M5
- **Fecha**: Rango del CSV (2026-02-XX)
- **Depósito Inicial**: Según guía ($250, $500, $1000, $1500)
- **Leverage**: 1:100 o 1:500

### 4. Ejecutar Tests
1. **Test G2** con depósito $500
2. **Test G4** con depósito $1500
3. **Test Restrictions** con depósito $1500

### 5. Analizar Results
- Abrir `ranges_G2.csv`, `ranges_G4.csv`, `ranges_Restrictions.csv` en Excel/Google Sheets
- Calcular métricas agregadas:
  * Win Rate global
  * PnL total
  * PnL promedio por rango
  * Max drawdown
  * Niveles promedio usados

### 6. Comparar Estrategias
```
G2 vs G4 vs Restrictions vs Toni
```

---

## 📝 Notas Importantes

### Filtrado de Señales
✅ El CSV `signals_simple.csv` **ya tiene filtro de mismo día**
- Solo rangos donde apertura y cierre son el mismo día
- Rangos que cruzan de día fueron descartados en el normalizador

### Formato del CSV
```csv
ts_utc;kind;side;price_hint;range_id;message_id;confidence
2026-02-09T11:54:13Z;range_open;SELL;5014.0;2026-02-09-3;17873;0.95
2026-02-09T12:15:30Z;range_close;;;2026-02-09-3;17874;
```

### Detección de Restricciones
El EA `Backtester_Xisco_Restrictions.mq5` busca:
1. Columna `confidence` en el CSV
2. Si no existe, usa 4 niveles por defecto
3. Busca keywords:
   - `RIESGO`, `RISK` → 2 niveles
   - `SIN PROMEDIOS`, `NO AVERAGING` → 1 nivel
   - `SOLO 1 PROMEDIO`, `1 PROMEDIO MAX` → 2 niveles

---

## 🎯 Objetivo del Backtesting

Validar que la operativa de Vikingo Trading es **rentable históricamente** con:

1. **Gestión de riesgo adecuada** (SL mental)
2. **Promedios controlados** (máx 3-4 niveles)
3. **Take profit realistas** (+20 pips)
4. **Respeto a restricciones** del canal

Si los resultados son positivos:
- ✅ Operativa validada
- ✅ Se puede escalar a SaaS multi-tenant
- ✅ Bot listo para producción

Si los resultados son negativos:
- ⚠️ Revisar parámetros (distancias, SL, TP)
- ⚠️ Considerar filtros adicionales (hora del día, volatility)
- ⚠️ Evaluar si operativa actual es adecuada para automatización

---

*Generado para adaptar el backtester a la operativa real de Vikingo Trading*
