# PROMPT - Ralph Loop: Fix Gráfico MT5

## Contexto
El gráfico de velas MT5 crashea cuando el usuario selecciona un trade. El componente está en `components/simple-candle-chart.tsx` y se usa desde `app/(dashboard)/backtester/page.tsx`.

## Problema Específico
- El usuario ejecuta un backtest (funciona)
- El usuario selecciona un trade de la tabla
- El gráfico debería mostrar las velas
- En lugar de eso, la página se crashea o no muestra nada

---

## ORDEN DE PRIORIDAD (SEGUIR ESTRICTAMENTE)

### 1. DIAGNÓSTICO: Identificar el crash
**Acción**:
1. Leer `components/simple-candle-chart.tsx` completo
2. Leer la sección de `TradeChartWrapper` en `app/(dashboard)/backtester/page.tsx`
3. Identificar TODOS los posibles puntos de fallo:
   - Accesos a propiedades undefined/null
   - Operaciones con NaN
   - Fechas inválidas
   - Canvas con dimensiones 0

**Output**: Lista de problemas encontrados con línea de código

---

### 2. FIX: Añadir validación defensiva
**Problema**: El componente asume que `trade` tiene todas las propiedades válidas.

**Acción**:
1. Añadir null checks en TODOS los accesos a `trade.*`
2. Añadir valores por defecto para propiedades opcionales
3. Envolver TODO el código del componente en try-catch
4. Si hay error, mostrar mensaje en lugar de crashear

**Código ejemplo**:
```typescript
// Al inicio del componente
if (!trade || !trade.entryPrice || !trade.exitPrice || !trade.entryTime || !trade.exitTime) {
  return <div className="text-center py-12 text-gray-400">Datos del trade incompletos</div>;
}
```

**Commit**: "fix: validacion defensiva en componente de grafico"

---

### 3. FIX: Validar datos antes de generar ticks
**Problema**: `generateSyntheticTicks` puede recibir datos inválidos

**Acción**:
1. Validar que `entryPrice` y `exitPrice` son números válidos
2. Validar que `entryTime` y `exitTime` son fechas válidas
3. Si algo falla, devolver array vacío y mostrar mensaje

**Commit**: "fix: validar datos antes de generar ticks sinteticos"

---

### 4. FIX: Proteger el canvas
**Problema**: El canvas puede intentar renderizar con datos inválidos

**Acción**:
1. Verificar que `candles` es un array no vacío antes de renderizar
2. Verificar que `minPrice` y `maxPrice` son números válidos
3. Si hay NaN en algún cálculo, usar valores por defecto

**Commit**: "fix: proteger renderizado del canvas"

---

### 5. FIX: Proteger elTradeChartWrapper
**Problema**: El wrapper puede pasar datos inválidos al componente

**Acción**:
1. Añadir validación en `TradeChartWrapper` antes de renderizar
2. Si `trade` no tiene datos completos, no renderizar el gráfico
3. Mostrar mensaje de "Cargando..." mientras se obtienen los ticks

**Commit**: "fix: validar trade antes de renderizar grafico"

---

### 6. TEST: Verificar que funciona
**Acción**:
1. Compilar con `npx tsc --noEmit`
2. Si hay errores, fixear
3. Verificar que el servidor responde

---

## REGLAS IMPORTANTES

1. **Siempre usar try-catch** en funciones críticas
2. **Siempre validar** antes de acceder a propiedades
3. **Siempre proporcionar fallback** si algo falla
4. **Un fix = un commit**
5. **Mensajes en español**

---

## VERIFICACIÓN

Después de cada commit:
```bash
npx tsc --noEmit
```

---

## COMPLETADO

Cuando el gráfico funcione sin crashear, responder: **RALPH_CHART_FIX_COMPLETE**
