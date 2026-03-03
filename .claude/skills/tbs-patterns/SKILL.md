---
name: tbs-patterns
description: Common patterns, pitfalls, and conventions for Trading Bot SaaS
user-invocable: false
---

# TBS — Patterns & Conventions

## Code Conventions
- Components: PascalCase, one per file, colocated with styles
- tRPC routers: camelCase procedures, always include tenantId validation
- Error handling: never expose raw errors to client — wrap in AppError
- Commits: imperative mood, max 72 chars, prefix with area (feat:, fix:, chore:)

## Common Pitfalls
1. **SQLite** doesn't support `FOR UPDATE` — use application-level locks
2. **Prisma + SQLite**: `@updatedAt` works, `@@index` on tenantId is CRITICAL
3. **tRPC** subscriptions are NOT supported — use polling for real-time
4. **lightweight-charts**: v5 API — don't use deprecated v4 patterns
5. **NextAuth v5 beta**: `auth()` in server components, `useSession()` client-side

## Testing
- Unit tests: vitest + testing-library
- E2E: playwright (when configured)
- QA agent runs after every significant feature
- Backtester: compare output against known good results (golden tests)

## Performance
- Backtester with 100K+ ticks: stream processing, don't load all in memory
- Dashboard charts: virtualize large datasets
- API: use `select` in Prisma to avoid over-fetching

## Security Checklist
- [ ] All API routes check auth + tenantId
- [ ] No raw SQL — Prisma only
- [ ] Stripe webhooks verify signature
- [ ] Bot API endpoints require valid API key
- [ ] Rate limiting on signal ingestion
