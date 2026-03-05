# TC-backtester-ux-mobile

**Status:** COMPLETED
**Branch:** fix/backtester-ux-mobile
**Created:** 2026-03-04
**Completed:** 2026-03-05

## Scope
Mejoras UX mobile para el Backtester UI. 4 fixes independientes.

## Fixes

### Fix 1: Tabla P&L overflow-x auto + sticky columns mobile
**File:** `app/(dashboard)/backtester/page.tsx`
**Problem:** En móvil, la tabla de trades no es navegable horizontalmente.
**Solution:**
- `overflow-x-auto` ya existe en línea 1100
- Añadir columnas sticky para # y P&L en móvil
- `th:first-child { position: sticky; left: 0; }`
- `th:last-child { position: sticky; right: 0; }`
- Background para ocultar scroll underneath

### Fix 2: Chart colapsable default collapsed <768px con localStorage
**File:** `app/(dashboard)/backtester/page.tsx`
**Problem:** El gráfico de velas ocupa mucho espacio en móvil.
**Solution:**
- Estado inicial: `collapsed` si `window.innerWidth < 768`
- Persistir preferencia en `localStorage('backtester-chart-expanded')`
- Detectar en `useEffect` inicial
- El botón de collapse ya existe (línea 1047-1065)

### Fix 3: Copy hover → tap con matchMedia detection
**File:** `app/(dashboard)/bot/page.tsx` (patrón a aplicar en backtester si hay copy)
**Problem:** El botón copy muestra feedback solo en hover.
**Solution:**
- Usar `window.matchMedia('(hover: hover)')` para detectar dispositivos touch
- En touch, mostrar feedback visual tras tap (checkmark 2s)
- Mantener hover para desktop

### Fix 4: Inputs config en cards con borde
**File:** `app/(dashboard)/backtester/page.tsx`
**Problem:** Los sliders ya tienen cards con borde (primary, purple, success)
- Pero los inputs (lot size, capital, filtros) están en divs planos
**Solution:**
- Agrupar inputs en cards con borde sutil
- Usar el patrón existente de sliders (líneas 515-623)
- Añadir bordes visuales a secciones de ejecución

## Out of Scope
- NO tocar lógica de backtesting (lib/backtest-engine*)
- NO tocar APIs (app/api/backtest, server/routers/backtester)
- NO cambiar comportamientos de trading

## Commits
1. `fix(backtester): tabla P&L con columnas sticky en móvil`
2. `fix(backtester): chart colapsado por defecto en móvil`
3. `fix(ui): copy button con feedback táctil`
4. `fix(backtester): inputs de config con cards y bordes`

## Verification
- [x] `npm run build` sin errores
- [ ] Test visual en Chrome DevTools móvil (375px)
- [ ] Tabla scrollea horizontalmente con columnas fijas
- [ ] Chart aparece colapsado en móvil, expandido en desktop
- [ ] Copy button muestra check en móvil
- [ ] Inputs tienen bordes visibles y agrupados
