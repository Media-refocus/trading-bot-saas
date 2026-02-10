# Resumen Modificaciones EAs Xisco - Sin SL/TP + S00 Scalper

> Fecha: 2026-02-10
> Cambios: Eliminar SL/TP mental, añadir S00 scalper

---

## 🔄 Cambios Realizados

### 1. **Eliminado Stop Loss y Take Profit**
- ~~SL Mental (250-300 pips)~~ → **ELIMINADO** (es gestión del trader)
- ~~TP en +20 pips~~ → **ELIMINADO** para L00
- L00 y Grid **cierran solo cuando llega range_close del CSV**

### 2. **Añadido S00 Scalper**
- **2 operaciones desde el inicio**:
  - **L00** (base): 0.01 lotes, sin SL/TP, corre hasta range_close
  - **S00** (scalper): 0.01 lotes, **cierra automáticamente en +20 pips**
- S00 es un "quick win" para asegurar beneficio en cada rango

### 3. **Lógica de Cierre**
```
S00: CheckScalperTP() → cierra cuando gain >= 20 pips
L00 + Grid: CloseRange() → cierran solo cuando llega range_close del CSV
```

---

## 📊 EAs Modificados

| EA | Capital | Step | Magic | Salida |
|----|---------|------|-------|--------|
| **G2** | $250-$500 | 30 pips | 20250671 | ranges_G2.csv |
| **G4** | $1000-$1500 | 20 pips | 20250672 | ranges_G4.csv |
| **Restrictions** | Variable | 20 pips | 20250673 | ranges_Restrictions.csv |

---

## 🎯 Diferencias vs Versión Anterior

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **SL** | Mental 250-300 | ❌ Eliminado (gestión trader) |
| **TP** | +20 total | ✅ Solo S00 en +20, L00 sin TP |
| **Operaciones** | 1 (L00) | 2 (L00 + S00) |
| **S00 Scalper** | ❌ No existía | ✅ +20 auto |
| **Grid** | Sin TP individual | Sin TP individual (igual) |
| **Cierre** | TP o range_close | Solo range_close (excepto S00) |

---

## 📋 Nuevos Inputs

### Comunes a todos los EAs
```mql5
// Lotes
input double  InpLotEntry        = 0.01;  // L00 - Posición base
input double  InpLotScalper      = 0.01;  // S00 - Scalper
input double  InpLotGrid         = 0.01;  // L01..Ln - Promedios

// Grid
input int     InpStepPips        = 20/30; // distancia entre promedios
input int     InpMaxLevels       = 4;     // 1 base + 3 promedios

// S00 Scalper
input int     InpScalperTPPips   = 20;    // TP de S00 en pips

// SL/TP (NO USADOS - para futuro automejora)
input double  InpSLMentalPips    = 0.0;   // NO USADO
input int     InpTPPips          = 0;      // NO USADO
```

### Específico de Restrictions
```mql5
// Detección automática de restricciones
// RIESGO → 2 niveles
// SIN PROMEDIOS → 1 nivel
// SOLO 1 PROMEDIO → 2 niveles
```

---

## 🔧 Scripts Nuevos

### 1. **copy-to-mt5.ps1** - Copia automática a MT5
```powershell
# Copia EAs y CSVs a todas las instalaciones de MT5
.\scripts\copy-to-mt5.ps1
```

**Funciones:**
- Busca todas las instalaciones de MT5 automáticamente
- Copia EAs a MQL5/Experts/
- Copia CSVs a MQL5/Files/
- Opción de abrir MetaEditor para compilar

### 2. **automejora_parametros.py** - Optimizador automático
```bash
# Optimización completa
python scripts/automejora_parametros.py

# Analizar una estrategia
python scripts/automejora_parametros.py analyze G2
```

**Funciones:**
- Analiza ranges.csv de cada estrategia
- Calcula métricas: win rate, profit factor, MFE/MAE
- Recomienda ajustes de parámetros
- Genera código MQL5 optimizado
- Exporta reporte JSON

---

## 📁 Salida de Backtesting

### CSVs Generados

**ranges_G2.csv** / **ranges_G4.csv**
```csv
range_id;side;open_ts;close_ts;mfe_pips;mae_pips;pnl_total_pips;max_levels;s00_closed
```

**ranges_Restrictions.csv**
```csv
range_id;side;open_ts;close_ts;mfe_pips;mae_pips;pnl_total_pips;max_levels;s00_closed;restriction
```

### Campos Nuevos vs Versión Anterior
- `s00_closed`: 1 si el scalper cerró en +20, 0 si no
- `restriction`: NONE, RIESGO, SIN_PROMEDIOS, SOLO_1_PROMEDIO (solo Restrictions)

---

## 🚀 Pasos para Ejecutar Backtesting

### 1. Copiar archivos a MT5
```powershell
cd C:\Users\guill\Projects\trading-bot-saas
.\scripts\copy-to-mt5.ps1
```

### 2. Compilar EAs
1. Abrir MetaEditor (tecla F4 en MT5)
2. Abrir cada EA (Backtester_Xisco_G2.mq5, etc.)
3. Compilar (F7)
4. Verificar que no hay errores

### 3. Configurar Strategy Tester
- **Symbol**: XAUUSD (Gold)
- **Model**: Every tick u Open prices only
- **Period**: M1 o M5
- **Date Range**: Según tu CSV
- **Deposit**: Según guía ($250, $500, $1000, $1500)
- **Currency**: USD
- **Leverage**: 1:100 o 1:500

### 4. Ejecutar Tests
1. Seleccionar EA (ej: Backtester_Xisco_G2)
2. Click en "Start"
3. Esperar finalización
4. Abrir "Results" tab
5. Exportar/Ver ranges.csv

### 5. Analizar Results
```bash
# Copiar ranges.csv al proyecto
cp "C:\Users\guill\AppData\Roaming\MetaQuotes\Terminal\...\MQL5\Files\ranges_G2.csv" "C:\Users\guill\Projects\trading-bot-saas\backtest_results\"

# Ejecutar automejora
python scripts/automejora_parametros.py
```

---

## 🎁 Sistema de Automejora

### ¿Qué Analiza?

1. **Win Rate**
   - >60% → Excelente (30 puntos)
   - 50-60% → Bueno (20 puntos)
   - 40-50% → Aceptable (10 puntos)

2. **Profit Factor**
   - >2.0 → Excelente (30 puntos)
   - 1.5-2.0 → Bueno (20 puntos)
   - 1.2-1.5 → Aceptable (10 puntos)

3. **Avg PnL**
   - >50 pips → Excelente (20 puntos)
   - 20-50 pips → Bueno (10 puntos)
   - 0-20 pips → Regular (5 puntos)

4. **Max Adverse Pips**
   - <100 pips → Excelente (20 puntos)
   - 100-200 pips → Bueno (10 puntos)
   - 200-300 pips → Regular (5 puntos)

### ¿Qué Recomienda?

#### Scalper TP
- Si S00 cierra <30% del tiempo → Reducir TP (más cierres)
- Si S00 cierra >80% del tiempo → Aumentar TP (más profit)

#### Grid Distance
- Si MAE max >4x step → Aumentar distancia (más cobertura)
- Si MAE max <2x step y avg_levels <2 → Reducir distancia (más agresivo)

#### Max Levels
- Si max_levels_used == InpMaxLevels → Aumentar (no cortar promedios)
- Si max_levels_used <50% InpMaxLevels → Reducir (simplificar)

---

## 📊 Ejemplo de Salida de Automejora

```
======================================================================
SISTEMA DE AUTOMEJORA DE PARÁMETROS
======================================================================

============================================================
ANALIZANDO: ranges_G2
============================================================

MÉTRICAS:
  csv_name: ranges_G2
  total_ranges: 386
  win_rate: 58.3
  avg_pnl: 25.4
  median_pnl: 18.2
  profit_factor: 1.65
  avg_mfe: 42.5
  avg_mae: -85.2
  max_adverse_pips: 320.0
  avg_levels: 1.8
  s00_closed_rate: 45.3

SCORE GLOBAL: 55.0/100

RECOMENDACIONES (2):
  [1] InpScalperTPPips
      Actual: 20
      Recomendado: 15
      Razón: S00 solo cierra el 45.3% de las veces. Reducir TP de 20 a 15 pips.
      Impacto: Aumentar win rate de S00

  [2] InpMaxLevels
      Actual: 4
      Recomendado: 5
      Razón: Se están usando todos los 4 niveles disponibles. Aumentar a 5.
      Impacto: Mejorar cobertura en rangos largos
```

---

## 🔜 Próximos Pasos

1. **Ejecutar copy-to-mt5.ps1**
2. **Compilar EAs en MetaEditor**
3. **Ejecutar backtests en MT5**
4. **Copiar results.csv a backtest_results/**
5. **Ejecutar automejora_parametros.py**
6. **Aplicar recomendaciones**
7. **Re-ejecutar tests con parámetros optimizados**
8. **Validar que mejoran resultados**

---

*Generado para simplificar operativa según feedback de Xisco*
