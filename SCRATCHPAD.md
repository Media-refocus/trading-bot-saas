# PLAN DE BUG FIXES - Rama clawd

## ORDEN DE IMPLEMENTACIÓN

### BUG 1 — Autenticación en tRPC (PRIMERO)
**Por qué primero:** Los otros bugs dependen de tener userId/tenantId en el contexto.

**Archivos a modificar:**
1. `server/api/trpc/init.ts` - Añadir sesión al contexto

**Pasos:**
1. Importar `getServerSession` de next-auth y authOptions
2. Extender `createContext` para incluir session
3. Crear `protectedProcedure` que verifique sesión
4. Mantener `procedure` como público para endpoints públicos

**Verificación:** `npx tsc --noEmit`

---

### BUG 2 — Aislamiento multi-tenant (SEGUNDO)
**Por qué segundo:** Depende del contexto de autenticación del Bug 1.

**Archivos a modificar:**
1. `server/api/trpc/routers/backtester.ts` - Conectar con Prisma

**Pasos:**
1. Importar `prisma` desde `@/server/db`
2. Usar `protectedProcedure` en lugar de `procedure`
3. Eliminar `backtestJobs` Map global
4. En `execute`: crear registro en DB con userId/tenantId
5. En `getHistory`: filtrar por userId

**Verificación:** `npx tsc --noEmit`

---

### BUG 3 — Stop Loss de emergencia (TERCERO)
**Por qué tercero:** Es independiente de los otros, pero mejor hacerlo después.

**Archivos a modificar:**
1. `lib/backtest-engine.ts` - Implementar SL fijo

**Pasos:**
1. Añadir propiedad `fixedStopLoss` para tracking
2. En `startSignal`: calcular precio del SL fijo si useStopLoss=true
3. En `processTick`: verificar SL fijo ANTES del trailing SL
4. Si precio cruza SL fijo → cerrar todo con "STOP_LOSS"

**Verificación:** `npx tsc --noEmit`

---

## COMMITS PLANIFICADOS

1. `fix(auth): add session to tRPC context and protectedProcedure middleware`
2. `fix(tenant): persist backtests to DB with userId isolation`
3. `fix(engine): implement fixed stopLoss alongside trailing SL`
