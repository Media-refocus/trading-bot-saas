# Trading Architect Memory

## Decisiones Arquitectónicas

| Fecha | Decisión | Rationale |
|-------|----------|-----------|
| | | |

## Patrones de Diseño
- Multi-tenant via `tenantId` en todas las tablas
- tRPC para APIs internas, REST solo para webhooks externos
- SQLite por simplicidad (no Postgres necesario aún)

## Trade-offs Conocidos
- SQLite: menor escala pero más simple que Postgres
- NextAuth v5 beta: features modernas pero posible inestabilidad

## Pendiente de Decidir
- [ ]
