# 🚀 PROMPT PARA NUEVA TERMINAL (Claude Code)

## 📋 ESTADO ACTUAL - 24 FEB 2026 (BACKTESTER COMPLETO)

### ✅ LO QUE ESTÁ FUNCIONANDO

**1. Backtester Web Completo**
- UI en `app/(dashboard)/backtester/page.tsx`
- Router tRPC en `server/api/trpc/routers/backtester.ts`
- Motor de simulación en `lib/backtest-engine.ts`
- Parser de señales en `lib/parsers/signals-csv.ts`
- **TODAS las 1516 señales generan trades** (cierre al final de cada rango)

**2. Sistema de Cache Optimizado**
- `lib/ticks-lru-cache.ts` - LRU cache de 500MB
- `lib/ticks-batch-loader.ts` - Batch loading de ticks por día
- `lib/backtest-cache.ts` - Cache de resultados por configuración
- `lib/backtest-jobs.ts` - Sistema de jobs en background

**3. Sistema de Autenticación**
- Registro: `app/api/register/route.ts`
- Login: Usa NextAuth con credentials
- Base de datos SQLite funcionando

**4. Datos Disponibles**
- `signals_simple.csv`: 388 señales (Oct 2025 - Feb 2026)
- `signals_intradia.csv`: 1516 señales intradía (Ago 2024 - Feb 2026)
- `docs/telegram_raw_messages.csv`: 27,439 mensajes raw

**5. Ticks MT5 (COMPLETOS)**
- **116,528,150 ticks** en SQLite (Prisma)
- Rango: **May 2024 - Feb 2026** (cubre TODAS las señales)
- Ubicación: Base de datos Prisma (`prisma/dev.db`)
- Archivos fuente: `data/ticks/XAUUSD_2024.csv.gz`, `XAUUSD_2025.csv.gz`, `XAUUSD_2026.csv.gz`

---

## ⚡ FUNCIONALIDADES IMPLEMENTADAS

### Cierre de Posiciones Automático
- Cada señal se cierra al recibir el mensaje "cerramos rango" de Telegram
- `closeTimestamp` se usa como límite de tiempo
- Si el trade no cerró por TP/SL, se cierra al último precio

### Stop Loss Fijo
- Implementado SL de emergencia configurable
- Se activa cuando el precio se mueve `stopLossPips` en contra

### LRU Cache
- Límite de 500MB para backtests completos
- Auto-evicción de días antiguos
- 338 días cargados en ~75 segundos

---

## 🎯 MEJORES RESULTADOS ENCONTRADOS

| Config | Profit | Win Rate | Max DD |
|--------|--------|----------|--------|
| TP 6, SL 18, grid 6x6 | $7,294 | 66% | bajo |
| TP 10, SL 50, grid 10x10 | $24,242 | 69% | medio |
| TP 15, SL 75, grid 15x15 | $53,082 | 71% | medio |
| **TP 20, SL 100, grid 20x20** | **$109,447** | **72%** | $8,044 |

Con $10,000 inicial: ~1,000% retorno en 18 meses

---

## 🎯 ENDPOINTS tRPC DISPONIBLES

| Endpoint | Descripción |
|----------|-------------|
| `backtester.execute` | Backtest síncrono (usa cache) |
| `backtester.executeAsync` | Crea job en background |
| `backtester.getJobStatus` | Estado de un job |
| `backtester.getAllJobs` | Todos los jobs |
| `backtester.getCacheStatus` | Estado del cache de ticks |
| `backtester.getSignalsInfo` | Info de señales |
| `backtester.listSignalSources` | Lista archivos de señales |

---

## 📂 ARCHIVOS CLAVE

| Archivo | Descripción |
|---------|-------------|
| `lib/backtest-engine.ts` | Motor de simulación con SL/TP/Trailing |
| `lib/ticks-lru-cache.ts` | Cache LRU de 500MB |
| `lib/ticks-batch-loader.ts` | Batch loading optimizado |
| `server/api/trpc/routers/backtester.ts` | Router tRPC |
| `components/backtester/` | Componentes UI |

---

## 🔧 STACK TECNOLÓGICO

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS
- **Backend:** tRPC v11, Prisma ORM
- **UI:** shadcn/ui (Button, Card, Input, Label)
- **Database:** SQLite (desarrollo) / PostgreSQL (producción)
- **Auth:** NextAuth con credentials provider
- **Cache:** LRU en memoria (500MB)

---

## 🚀 ARRANCAR Y PROBAR

```bash
# Arrancar servidor
cd C:\Users\guill\Projects\trading-bot-saas
npm run dev

# Probar backtest
curl -X POST "http://localhost:3000/api/trpc/backtester.execute" \
  -H "Content-Type: application/json" \
  -d '{"json":{"config":{"signalsSource":"signals_intradia.csv","useRealPrices":true,"takeProfitPips":20,"stopLossPips":100,"pipsDistance":20,"maxLevels":20,"lotajeBase":0.1},"signalLimit":1516}}'
```

Abrir http://localhost:3000/backtester

---

## ⚠️ PENDIENTE / PRÓXIMOS PASOS

1. **UI del backtester** - Mostrar resultados en tiempo real
2. **Optimizador de estrategias** - Probar múltiples configuraciones
3. **Guardar estrategias** - Persistir configuraciones favoritas
4. **Sistema de colas** - Backtests pesados sin bloquear UI
5. **Tests automatizados** - Evitar regresiones

---

## 🔄 PR AGENT LOOP — REGLAS DE TRABAJO (2026-02-20)

Este repo usa el sistema de Deterministic PR Agent Loop. Como CC trabajando aquí:

### Reglas obligatorias
- **NUNCA push directo a `main`** — siempre crear branch descriptivo (`feat/`, `fix/`, `chore/`)
- **Siempre abrir PR** después de implementar — no hacer merge tú mismo
- **Un branch = una tarea** — no mezclar múltiples issues en el mismo PR
- **Commits atómicos** — cada commit reversible individualmente

### Si el CI falla
1. Leer los logs del workflow `.github/workflows/pr-agent-loop.yml`
2. Arreglar el problema específico
3. Push al mismo branch (no crear uno nuevo)
4. El loop se re-activa automáticamente

### Risk tiers (definidos en `risk-contract.json`)
- **HIGH** (requiere Claude review + CI): `app/api/**`, `server/api/trpc/routers/**`, `db/schema.ts`
- **LOW** (solo CI): todo lo demás

---

## ⚠️ REGLAS DE SEGURIDAD (Plan Mode)

Antes de cualquier operación destructiva:
> "Voy a hacer X. Riesgo: Y. Alternativa si falla: Z."

- **NUNCA** modificar `db/schema.ts` sin backup previo
- **NUNCA** tocar endpoints de autenticación sin tests
- **NUNCA** borrar datos de señales/ticks (son irreemplazables)

---

## 🤝 TRABAJO COLABORATIVO

Este repo puede ser editado simultáneamente por:
- **Guillermo** desde su PC local (branching desde `main`)
- **Clawd/CC en VPS** (branching desde `main`)

**Para evitar conflictos:**
- Siempre `git pull origin main` antes de empezar una nueva tarea
- Trabajar en branches — nunca editar `main` directamente
- Comunicar qué tarea estás trabajando (via Mission Control task #)
