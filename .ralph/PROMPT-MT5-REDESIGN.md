# PROMPT: Rediseño Backtester estilo MT5 Strategy Tester

## OBJETIVO
Rediseñar el backtester actual para que se parezca al MT5 Strategy Tester, enfocándose en la parte operativa (playback de trades) y no en todos los features de MT5.

---

## ORDEN DE PRIORIDAD

### 1. LAYOUT PRINCIPAL
Crear estructura de tabs similar a MT5:
- Settings (configuración de backtest)
- Backtest (resultados y tabla de trades)
- Graph (curva de equity)
- Journal (logs)

### 2. PANEL DE CONFIGURACIÓN (Settings)
Componentes:
- Dropdown de fuente de señales (signals_simple.csv, signals_intradia.csv)
- Filtros de fecha (desde/hasta)
- Sliders de configuración (spread, slippage, lot size)
- Checkbox "Visual Mode" para activar playback animado
- Slider de velocidad (1-32 como MT5)
- Botón "Start" para ejecutar backtest

### 3. ÁREA DE GRÁFICO (Visual Mode)
Canvas con:
- Velas japonesas
- Marcadores de entrada/salida
- Líneas de niveles de grid
- Precio actual animado durante playback
- Controles: Play/Pause/Stop, Speed slider, Zoom +/-

### 4. TABLA DE DEALS (Backtest tab)
Columnas estilo MT5:
- # (número de deal)
- Time (fecha/hora)
- Type (BUY/SELL)
- Order (ticket)
- Volume (lotes)
- Price (precio ejecución)
- S/L (stop loss)
- T/P (take profit)
- Profit (ganancia/pérdida)
- Balance (balance acumulado)

Colorear:
- Verde: profitable trades
- Rojo: losing trades

### 5. ESTADÍSTICAS (Report sub-tab)
Panel con métricas MT5:
- Total Net Profit
- Gross Profit / Gross Loss
- Profit Factor
- Total Trades
- Win Rate %
- Max Drawdown
- Average Trade
- Largest Win/Loss

### 6. CURVA DE EQUITY (Graph tab)
Gráfico con:
- Línea de Balance (azul)
- Línea de Equity (verde)
- Áreas de drawdown sombreadas en rojo
- Eje X: tiempo
- Eje Y: balance

### 7. JOURNAL (Log tab)
Log estilo MT5:
- Timestamp
- Tipo de evento (INFO, WARNING, ERROR)
- Mensaje descriptivo

---

## ESTILO VISUAL (Dark Theme como MT5)

Colores base:
- Background: #1E1E1E
- Panel: #2D2D2D
- Border: #3C3C3C
- Text: #CCCCCC
- Accent: #0078D4 (azul MT5)
- Buy/Profit: #00C853 (verde)
- Sell/Loss: #FF5252 (rojo)

Fuentes:
- Monospace para datos numéricos
- Sans-serif para labels

---

## COMPONENTES A CREAR/MODIFICAR

1. `components/backtester/mt5-layout.tsx` - Layout principal con tabs
2. `components/backtester/settings-panel.tsx` - Panel de configuración
3. `components/backtester/deals-table.tsx` - Tabla de deals estilo MT5
4. `components/backtester/statistics-panel.tsx` - Estadísticas
5. `components/backtester/equity-chart.tsx` - Curva de equity
6. `components/backtester/journal-panel.tsx` - Log de eventos
7. `components/backtester/playback-controls.tsx` - Controles de playback

---

## FUNCIONALIDAD CLAVE

### Playback Animado
1. Usuario hace click en "Start"
2. Gráfico muestra velas históricas
3. Se reproduce tick por tick (o candle por candle)
4. Marcadores aparecen cuando se ejecutan trades
5. Balance se actualiza en tiempo real
6. Usuario puede pausar/ajustar velocidad

### Interacción
- Click en fila de deals → salta a ese punto en el gráfico
- Hover sobre vela → OHLCV tooltip
- Click en gráfico → pausa y muestra detalle

---

## NO INCLUIR (features MT5 que no necesitamos)
- Optimization (batch testing con múltiples parámetros)
- Multi-currency testing
- Forward testing
- EA parameters (Inputs tab) - usamos señales predefinidas
