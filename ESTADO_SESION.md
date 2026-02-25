# Estado de Sesión - 25 Febrero 2026 (Actualizado)

## Últimos Commits
```
[pendiente commit] feat: nuevo sistema de planes en EUR con 4 tiers y onboarding
```

## Completado Hoy (Sesión 2)

### 1. Sistema de Planes Actualizado a EUR
- **Starter** - 57€/mes + 97€ implementación
  - 1 posición, 2 niveles, 5 backtests/mes
  - Paper Trading básico
- **Trader** - 97€/mes (implementación incluida)
  - 3 posiciones, 4 niveles, 20 backtests/mes
  - + Trailing SL, Grid Avanzado
- **Pro** - 197€/mes (implementación incluida)
  - 5 posiciones, 6 niveles, backtests ilimitados
  - + Optimizador automático, Dashboard métricas, Soporte prioritario
- **Enterprise** - 497€/mes (implementación incluida)
  - 10 posiciones, 10 niveles, todo ilimitado
  - + Multi-cuenta MT5, API Access, VPS dedicado, Soporte 24/7

### 2. Schema Actualizado
- Modelo `Plan` con nuevos campos:
  - `implementationFee` - Fee de implementación (null = incluido)
  - `hasOptimizador` - Optimizador de parámetros automático
  - `hasBacktestsIlimitados` - Backtests ilimitados
  - `hasPaperTrading` - Paper trading disponible
  - `hasMetricsDashboard` - Dashboard de métricas avanzado
  - `hasMultiCuenta` - Multi-cuenta MT5
  - `hasApiAccess` - API access
  - `hasVpsDedicado` - VPS dedicado
  - `hasSoporte247` - Soporte 24/7
- Modelo `Tenant` actualizado:
  - `implementationFeePaid` - Si ha pagado el fee
  - `onboardingCompletedAt` - Fecha de completado
  - `vpsAccessGranted` - Si tiene acceso VPS
- Nuevo modelo `VpsAccess` - Datos de acceso al VPS del cliente

### 3. Página de Onboarding
- `/onboarding` - Proceso de configuración en 5 pasos:
  1. Seleccionar plan
  2. Pagar implementación (solo Starter)
  3. Proporcionar acceso VPS
  4. Configurar MT5
  5. Bot activado

### 4. APIs de Onboarding
- `GET /api/onboarding/status` - Estado del proceso
- `POST /api/onboarding/vps` - Guardar datos VPS
- `POST /api/onboarding/mt5` - Guardar credenciales MT5

### 5. lib/plans.ts Actualizado
- Nuevas funciones de verificación:
  - `canUseOptimizador()` - Verifica acceso al optimizador
  - `canRunBacktest()` - Verifica límite de backtests
  - `canUseMultiCuenta()` - Verifica multi-cuenta
  - `canUseApi()` - Verifica API access
  - `needsImplementationFee()` - Verifica si necesita pagar fee
  - `markImplementationFeePaid()` - Marca fee como pagado

---

## Contrato con Xisco - Resumen

| Concepto | Acordado |
|----------|----------|
| Precio base Bot | 57€/mes (IVA incl.) |
| Implementación | 97€ (IVA incl.) |
| Ventas en Comunidad | 60% Agencia / 40% Xisco |
| Ventas fuera | 100% Agencia |
| Royalty estrategia Xisco | 15% |

---

## Pendiente

### MT4 Support
- MT4 no tiene API como MT5
- Opciones:
  1. Solo MT5 (documentar)
  2. Copier externo MT5→MT4
  3. EA receptor para MT4 (WebSocket)
  4. Bridge DLL

### Stripe Integration
- Webhooks para pagos
- Gestión de suscripciones
- Prorateo al cambiar de plan

### Encriptación
- Credenciales VPS y MT5 en texto plano (TODO: encriptar)

---

## Comandos para Retomar

```bash
# Ir al proyecto
cd /c/Users/guill/Projects/trading-bot-saas-bot

# Ver estado
git status
git log --oneline -5

# Arrancar dev
npm run dev

# Ver planes en DB
npx tsx scripts/check-plans.ts

# Regenerar Prisma Client
npx prisma generate
```

---

## Archivos Modificados Hoy
- `prisma/schema.prisma` - Nuevo modelo Plan y VpsAccess
- `prisma/seed.ts` - 4 planes nuevos en EUR
- `lib/plans.ts` - Funciones de verificación ampliadas
- `app/(dashboard)/pricing/page.tsx` - 4 planes con EUR
- `app/(dashboard)/onboarding/page.tsx` - Nuevo
- `app/api/plans/route.ts` - Features ampliadas
- `app/api/onboarding/status/route.ts` - Nuevo
- `app/api/onboarding/vps/route.ts` - Nuevo
- `app/api/onboarding/mt5/route.ts` - Nuevo
- `components/ui/alert.tsx` - Nuevo
- `scripts/check-plans.ts` - Nuevo
