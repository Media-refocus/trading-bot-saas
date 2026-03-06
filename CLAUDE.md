# Trading Bot SaaS — CLAUDE.md

> SaaS multi-tenant: señales XAUUSD desde Telegram → MetaTrader 5. Backtester web, bot operativa, provisioning VPS, dashboard.

## Árbol de decisión
- Arquitectura / cambios de schema DB → consultar agent `trading-architect` PRIMERO
- Feature backend (tRPC, Prisma, API) → agent `trading-backend`
- Feature frontend (UI, charts, dashboard) → agent `trading-frontend`
- Infra / provisioning / deploy → agent `trading-devops`
- Review de seguridad o QA → agent `trading-qa` (SIEMPRE al final)
- Estado del proyecto → `tasks/todo.md`
- Lecciones aprendidas → `tasks/lessons.md`

## Stack
- **Frontend:** Next.js 15 + TypeScript + Tailwind + shadcn/ui + lightweight-charts
- **Backend:** tRPC v11 + Next.js API Routes + Prisma ORM
- **DB:** SQLite (multi-tenant con tenantId)
- **Auth:** NextAuth.js v5 beta | **Payments:** Stripe
- **Bot:** Python (VPS Windows, conecta via API REST)

## Agent Team

| Agent | Role | Cuándo invocar |
|-------|------|----------------|
| `trading-architect` | Arquitectura, schema DB | Antes de cambios estructurales |
| `trading-backend` | tRPC, Prisma, API, bot | Features backend |
| `trading-frontend` | Dashboard, UI, charts | Features frontend |
| `trading-devops` | Provisioning, deploy, monitoring | Infra y deploy |
| `trading-qa` | Tests, security, code review | SIEMPRE al final de cada feature |

**Team workflow:** Architect → Backend → Frontend → DevOps (si aplica) → QA (obligatorio)

## Project Structure
```
app/(auth)/           — Login, Register
app/(dashboard)/      — Dashboard, Backtester, Settings, Setup
app/api/bot/          — Bot REST endpoints
app/api/signals/      — Signal ingestion from Telegram
lib/                  — Core logic (backtest-engine, ticks-cache, parsers)
server/api/trpc/      — tRPC routers (backtester, auth, tenant, strategies)
prisma/               — Schema + migrations
provisioning/         — VPS setup scripts (Windows + Linux)
```

## Multi-tenant rules (CRÍTICO)
- EVERY DB query MUST filter by `tenantId`
- EVERY API endpoint MUST verify tenant ownership
- Bot API endpoints validate per-tenant API key
- Data NEVER leaks between tenants

## Agent Coordination
- Pre-flight OBLIGATORIO: leer `SESSION_CONTEXT.md` + `MEMORY.md` antes de actuar
- Shared dirs (lib/): documentar en MEMORY.md qué estás tocando
- Conflictos: architect decide prioridad

## Commit Rules
- NUNCA commit parcial sin terminar la tarea — arregla el root cause antes
- Si el problema es mayor de lo esperado → PARA y pregunta

## ⚠️ CC Pitfalls — Errores frecuentes
- **Omitir `tenantId` en queries Prisma** → data leak entre tenants, bug crítico
- **Usar `db.` en vez de `prisma.`** → naming convention del proyecto
- **Crear endpoint en `/app/api/` en vez de `server/api/trpc/`** → arquitectura tRPC, no REST directo
- **Cambiar schema Prisma sin consultar trading-architect agent** → puede romper migraciones
- **No correr `npx prisma generate` tras cambio de schema** → tipos TypeScript desactualizados
- **Deploy en `master` directamente** → siempre feature branch + PR
- **Olvidar que SQLite es multi-tenant** → cada query DEBE tener `where: { tenantId }`

## 🔴 NUNCA (app financiera — bugs = dinero real perdido)
- NUNCA omitir filtro `tenantId` en queries DB → data leak entre tenants
- NUNCA exponer API keys o tenantId en logs de producción
- NUNCA commit con tests en rojo
- NUNCA saltarse QA agent en features que tocan señales/trades
- NUNCA borrar datos de producción sin backup verificado
- NUNCA deploy directo a `master` sin feature branch
