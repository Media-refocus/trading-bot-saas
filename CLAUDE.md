# 🚀 PROMPT PARA NUEVA TERMINAL (Claude Code)

## 📋 ESTADO ACTUAL - 13 FEB 2026 (BACKTESTER OPTIMIZADO)

### ✅ LO QUE ESTÁ FUNCIONANDO

**1. Backtester Web Optimizado**
- UI en `app/(dashboard)/backtester/page.tsx`
- Router tRPC en `server/api/trpc/routers/backtester.ts`
- Motor de simulación en `lib/backtest-engine.ts`
- Parser de señales en `lib/parsers/signals-csv.ts`

**2. Sistema de Optimización (NUEVO)**
- `lib/ticks-cache.ts` - Cache de ticks en memoria (carga al iniciar)
- `lib/backtest-cache.ts` - Cache de resultados por configuración
- `lib/backtest-jobs.ts` - Sistema de jobs en background
- `instrumentation.ts` - Precarga de ticks al arrancar servidor

**3. Sistema de Autenticación**
- Registro: `app/api/register/route.ts`
- Login: Usa NextAuth con credentials
- Base de datos SQLite funcionando

**4. Datos Disponibles**
- `signals_simple.csv`: 388 señales (Oct 2025 - Feb 2026)
- `signals_intradia.csv`: 1516 señales intradía (Ago 2024 - Ene 2026)
- `docs/telegram_raw_messages.csv`: 27,439 mensajes raw

**5. Ticks MT5**
- `data/ticks/XAUUSD_2024.csv.gz`: Solo 2-5 enero 2024 (incompleto)
- Pendiente descargar ticks completos para 1516 señales

---

## ⚡ OPTIMIZACIONES IMPLEMENTADAS

### Cache de Ticks en Memoria
- Precarga todos los ticks al arrancar el servidor
- Búsqueda binaria para acceso O(log n)
- Índice por fecha para búsquedas rápidas
- Reduce tiempo de backtest de minutos a segundos

### Cache de Resultados
- Hash único por configuración
- Segunda ejecución instantánea (desde cache)
- TTL de 24 horas
- Máximo 100 resultados en cache

### Sistema de Jobs
- 2 jobs concurrentes máximo
- Cola con prioridades
- Endpoint `executeAsync` para backtests pesados
- Seguimiento de progreso en tiempo real

---

## 🎯 ENDPOINTS tRPC DISPONIBLES

| Endpoint | Descripción |
|----------|-------------|
| `backtester.execute` | Backtest síncrono (usa cache) |
| `backtester.executeAsync` | Crea job en background |
| `backtester.getJobStatus` | Estado de un job |
| `backtester.getAllJobs` | Todos los jobs (activos, cola, completados) |
| `backtester.getCacheStatus` | Estado del cache de ticks |
| `backtester.getSignalsInfo` | Info de señales (requiere `source`) |
| `backtester.listSignalSources` | Lista archivos de señales |
| `backtester.initCache` | Inicializa cache manualmente |

---

## 📂 ARCHIVOS CLAVE

| Archivo | Descripción |
|---------|-------------|
| `lib/ticks-cache.ts` | Cache de ticks en memoria |
| `lib/backtest-cache.ts` | Cache de resultados |
| `lib/backtest-jobs.ts` | Sistema de jobs |
| `lib/backtest-engine.ts` | Motor de simulación |
| `server/api/trpc/routers/backtester.ts` | Router tRPC |
| `scripts/parse_telegram_signals.py` | Parser de Telegram |
| `run-backtests-intradia.ps1` | Script para 30 estrategias |

---

## 🔧 STACK TECNOLÓGICO

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS
- **Backend:** tRPC v11, Prisma ORM
- **UI:** shadcn/ui (Button, Card, Input, Label)
- **Database:** SQLite (desarrollo) / PostgreSQL (producción)
- **Auth:** NextAuth con credentials provider
- **Cache:** En memoria (Node.js)

---

## 🚀 ARRANCAR Y PROBAR

```bash
# Arrancar servidor
cd C:\Users\guill\Projects\trading-bot-saas
npm run dev

# En otra terminal, ejecutar 30 estrategias
powershell -ExecutionPolicy Bypass -File run-backtests-intradia.ps1
```

Abrir http://localhost:3000/backtester

---

## ⚠️ PENDIENTE

1. **Descargar ticks completos** de MT5 (Jun 2024 - Feb 2026)
2. **Probar con 1516 señales** y ticks reales
3. **Verificar rendimiento** con múltiples usuarios concurrentes
