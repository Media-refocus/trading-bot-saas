# Trading Bot SaaS - TODO

## Sprint Actual: MA/EMA Overlay + Multi-timeframe

### Completado ✅
- [x] MA Overlay component (ma-overlay.tsx)
  - SMA 20, SMA 50, EMA 12, EMA 26
  - Toggle para mostrar/ocultar cada una
  - Colores diferenciados: amarillo, cyan, morado, rosa
  - Cálculo optimizado con memoización (useMALines hook)
- [x] Multi-timeframe tabs
  - 1m, 5m, 15m, 1h, 4h, 1D + Auto
  - Recompresión de velas usando compressCandles()
  - Estado persistente del timeframe seleccionado
- [x] Integración en candle-chart-canvas.tsx
  - Dibujo de líneas de MA sobre velas
  - Soporte para múltiples MA simultáneas
- [x] npm run build pasa sin errores

### Archivos Creados/Modificados
```
components/backtester/ma-overlay.tsx (nuevo)
components/backtester/candle-chart-canvas.tsx
components/backtester/enhanced-candle-viewer.tsx
```

---

## Sprint Anterior: Mini-map para Backtester

### Completado ✅
- [x] Crear components/backtester/mini-map.tsx
  - [x] Canvas 60px altura
  - [x] Línea/área de todas las velas comprimidas
  - [x] Rectángulo viewport con borde azul
  - [x] Click para navegar
  - [x] Drag del rectángulo para navegar
- [x] Integrar en enhanced-candle-viewer.tsx
- [x] Verificar npm run build pasa

### Completado ✅ (Sprint Anterior)
- [x] Crosshair interactivo con OHLC tooltip
- [x] Zoom con scroll wheel centrado en cursor
- [x] Equity curve panel debajo del chart
- [x] Trade arrows ↑↓ reemplazando líneas horizontales
- [x] npm run build pasa sin errores

---

## Implementación Detallada

### 1. Crosshair Interactivo
- Cursor vertical/horizontal que sigue mouse
- Líneas punteadas semitransparentes
- Precio actual en marker a la derecha
- Tooltip OHLC con fecha/hora

### 2. Zoom con Scroll Wheel
- Sensibilidad: 0.001
- Rango: 0.5x - 3x
- Zoom centrado en posición actual

### 3. Equity Curve Panel
- Panel de 100px debajo del chart principal
- Curva azul con línea
- Labels de min/max equity
- Línea base punteada si baja de $10,000

### 4. Trade Arrows
- Flecha verde ↑ para BUY (debajo del low)
- Flecha rojo ↓ para SELL (encima del high)
- Label de entry price a la derecha

---

## Archivos Modificados
```
- components/backtester/candle-chart-canvas.tsx
- components/backtester/enhanced-candle-viewer.tsx
```

---

## Sprint Anterior: Visor de Velas Mejorado

### Completado
- [x] Análisis del código existente
- [x] Plan de implementación
- [x] Fase 1: Virtual Scrolling - hooks/use-virtual-candles.ts
- [x] Fase 2: Compresión de Velas - lib/candle-compression.ts
- [x] Fase 3: Selector de Período - period-selector.tsx
- [x] Fase 4: Modos de Visualización (detail, operative, overview)
- [x] Fase 5: Playback con x50 - playback-controls.tsx
- [x] Fase 6: Componente EnhancedCandleViewer
