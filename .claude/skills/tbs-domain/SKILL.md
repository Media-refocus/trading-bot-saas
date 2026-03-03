---
name: tbs-domain
description: Trading Bot SaaS domain knowledge — architecture, multi-tenancy rules, financial app constraints
user-invocable: false
---

# Trading Bot SaaS — Domain Knowledge

## Architecture
- Multi-tenant SaaS: XAUUSD signals from Telegram → MetaTrader 5
- Web backtester, operative bot, VPS provisioning, dashboard
- EVERY query MUST filter by tenantId — data leak = legal problem + trust lost

## Stack
- Frontend: Next.js 15 + TypeScript + Tailwind + shadcn/ui + lightweight-charts
- Backend: tRPC v11 + Next.js API Routes + Prisma ORM
- DB: SQLite (NOT Postgres) — design queries accordingly
- Auth: NextAuth.js v5 beta | Payments: Stripe
- Bot: Python on client's Windows VPS, connects via REST API

## Critical Constraints
1. **Financial application** — bugs = real money lost for clients
2. **Multi-tenancy** — NEVER leak data between tenants
3. **tRPC** for internal APIs, REST only for external webhooks (Stripe, bot heartbeat)
4. **Prisma schema** is the source of truth for data model

## Key Patterns
- Backtester: tick-level simulation with configurable strategies
- Signal flow: Telegram → parser → strategy evaluation → MT5 execution
- Bot heartbeat: VPS → SaaS API every 30s (health + position sync)
- Provisioning: automated VPS setup scripts for Windows clients

## File Ownership Map
```
app/(auth)/           — auth flows
app/(dashboard)/      — dashboard, backtester, settings
app/api/bot/          — bot REST endpoints
app/api/signals/      — signal ingestion
components/           — UI components
lib/                  — core logic (backtest-engine, parsers)
server/api/trpc/      — tRPC routers
prisma/               — schema + migrations
operative/            — strategy configs
provisioning/         — VPS setup scripts
```
