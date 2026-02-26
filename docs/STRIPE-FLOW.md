# Stripe Integration Flow - Trading Bot SaaS

## Overview

Sistema completo de suscripciones para el Trading Bot SaaS con Stripe.

---

## 1. Onboarding Flow (Sin Pagos)

```
┌─────────────────────────────────────────────────────────────────┐
│                    ONBOARDING FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Usuario se registra en /register                            │
│     ↓                                                           │
│  2. Se crea:                                                    │
│     - Tenant (nuevo tenant)                                     │
│     - User (vinculado al tenant)                                │
│     - BotConfig (vacío, status=PENDING_SETUP)                   │
│     ↓                                                           │
│  3. Usuario hace login → redirigido a /dashboard                │
│     ↓                                                           │
│  4. Dashboard detecta BotConfig vacío → muestra SETUP WIZARD    │
│     ↓                                                           │
│  5. Wizard pasos:                                               │
│     a) Configurar parámetros del bot (lotes, grid, etc.)        │
│     b) Añadir cuenta MT5 (login, password, server)              │
│     c) Configurar Telegram (opcional pero recomendado)          │
│     d) Descargar bot Python + obtener API key                   │
│     ↓                                                           │
│  6. Usuario descarga bot, configura con su API key              │
│     ↓                                                           │
│  7. Bot inicia → primer heartbeat → status=ONLINE               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Stripe Subscription Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    STRIPE SUBSCRIPTION FLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FLUJO:                                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Register → 14 días TRIAL (status=TRIAL)                 │  │
│  │       ↓                                                   │  │
│  │  Trial incluye: Plan PRO completo (todas las features)   │  │
│  │       ↓                                                   │  │
│  │  Día 10: Email recordatorio "Tu trial expira en 4 días"  │  │
│  │       ↓                                                   │  │
│  │  Día 14: Trial expira                                     │  │
│  │       ├─ Si NO pagó → status=PAUSED, bot se detiene      │  │
│  │       └─ Si pagó → status=ACTIVE, bot continúa           │  │
│  │       ↓                                                   │  │
│  │  Pagos recurrentes (Stripe webhook):                      │  │
│  │       - invoice.paid → status=ACTIVE                      │  │
│  │       - invoice.failed → email + retry                    │  │
│  │       - subscription.deleted → status=PAUSED              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Payment Failure Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  PAGO FALLIDO - FLUJO                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Día 0: Pago falla (tarjeta caducada, sin fondos, etc.)         │
│  ─────────────────────────────────────────────────              │
│  • status → PAST_DUE                                            │
│  • Bot SIGUE funcionando (no cortamos servicio inmediato)       │
│  • Email automático: "Tu pago ha fallado, actualiza tu tarjeta" │
│  • Stripe reintenta automáticamente en 3 días                   │
│                                                                 │
│  Día 3: Segundo intento de cobro                                │
│  ─────────────────────────────                                  │
│  • Si funciona → status → ACTIVE, todo ok                       │
│  • Si falla → otro email + reintento en 5 días más              │
│                                                                 │
│  Día 8: Tercer intento falla                                    │
│  ─────────────────────────                                      │
│  • status → PAUSED                                              │
│  • Bot se DETIENE                                               │
│  • Email: "Tu suscripción ha sido pausada. Actívala para        │
│    continuar operando"                                          │
│  • Dashboard muestra banner: "Pago pendiente"                   │
│                                                                 │
│  Recuperación:                                                  │
│  ───────────                                                    │
│  • Usuario actualiza tarjeta → cobro inmediato → ACTIVE         │
│  • Si pasan 30 días sin pagar → status → CANCELLED              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Resumen: 8 días de gracia, 3 intentos de cobro, luego pausa.**

---

## 4. Bot Access Control

```
┌─────────────────────────────────────────────────────────────────┐
│                    BOT ACCESS CONTROL                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  El bot Python hace requests a la API con su API key:           │
│                                                                 │
│  GET /api/bot/config                                            │
│  ──────────────────────                                         │
│  1. Valida API key (bcrypt compare)                             │
│  2. Busca BotConfig por API key hash                            │
│  3. Verifica subscriptionStatus:                                │
│     ├─ TRIAL/ACTIVE → Retorna config ✓                          │
│     ├─ PAUSED/EXPIRED → 402 Payment Required ✗                 │
│     └─ CANCELLED → 403 Forbidden ✗                              │
│  4. Si OK, retorna:                                             │
│     - Config del bot (lots, grid, etc.)                         │
│     - Cuentas MT5 (desencriptadas)                              │
│     - Telegram config (si aplica)                               │
│                                                                 │
│  El bot:                                                        │
│  - Si recibe 200 → opera normalmente                            │
│  - Si recibe 402/403 → se pausa, muestra mensaje al usuario    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Database Schema Updates

```prisma
// Añadir a BotConfig
model BotConfig {
  // ... existing fields ...

  // Stripe
  stripeCustomerId        String?   // cus_xxx
  stripeSubscriptionId    String?   // sub_xxx
  stripePriceId           String?   // price_xxx

  // Subscription
  subscriptionStatus      SubscriptionStatus @default(TRIAL)
  subscriptionPlan        String?           // "basic", "pro", "enterprise"
  trialEndsAt             DateTime?         // Fecha fin del trial
  subscriptionEndsAt      DateTime?         // Fecha fin del periodo pagado

  // Limits según plan
  maxAccounts             Int      @default(1)
  telegramEnabled         Boolean  @default(false)
  backtestEnabled         Boolean  @default(false)
}

enum SubscriptionStatus {
  TRIAL         // En período de prueba
  ACTIVE        // Suscripción activa y pagada
  PAST_DUE      // Pago fallido, en período de gracia
  PAUSED        // Pausado por usuario o sistema
  CANCELLED     // Cancelado permanentemente
  EXPIRED       // Trial expirado sin pago
}
```

---

## 6. Stripe Webhook Endpoints

```typescript
// app/api/stripe/webhook/route.ts

POST /api/stripe/webhook
─────────────────────────

Eventos a manejar:

1. checkout.session.completed
   - Usuario completó el checkout
   - Crear/actualizar suscripción en DB
   - Activar features según plan

2. invoice.paid
   - Pago mensual exitoso
   - Actualizar subscriptionEndsAt
   - status → ACTIVE

3. invoice.payment_failed
   - Pago falló
   - Email al usuario
   - Si es 3er intento → PAST_DUE → PAUSED

4. customer.subscription.updated
   - Cambio de plan (upgrade/downgrade)
   - Actualizar límites (maxAccounts, etc.)

5. customer.subscription.deleted
   - Cancelación definitiva
   - status → CANCELLED
   - Bot se detiene
```

---

## 7. Client Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│                 CLIENT TIMELINE                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  MINUTO 0-5: Registro                                           │
│  ────────────────────                                           │
│  → Crea cuenta con email/password                               │
│  → Ve dashboard vacío con "Configurar Bot"                      │
│                                                                 │
│  MINUTO 5-15: Setup Wizard                                      │
│  ────────────────────────                                       │
│  → Configura parámetros (lotes, grid, trailing)                 │
│  → Añade cuenta MT5                                             │
│  → Configura canal Telegram (opcional)                          │
│  → Ve su API key: "sk_live_xxxxxxxxxxxx"                        │
│  → Descarga bot Python (link o instrucciones)                   │
│                                                                 │
│  MINUTO 15-30: Instalación Bot                                  │
│  ──────────────────────────                                     │
│  → Copia bot a su VPS Windows                                   │
│  → Edita .env con su API key                                    │
│  → Ejecuta install.bat                                          │
│  → Ejecuta start.bat                                            │
│                                                                 │
│  MINUTO 30+: Bot Operando                                       │
│  ─────────────────────                                          │
│  → Bot conecta a MT5                                            │
│  → Bot conecta a Telegram                                       │
│  → Ve en dashboard: "🟢 Online"                                 │
│  → Recibe notificaciones en Telegram                            │
│  → Ve trades y estadísticas en dashboard                        │
│                                                                 │
│  DÍA 14: Fin Trial                                              │
│  ─────────────────                                              │
│  → Email: "Tu trial termina hoy, activa tu plan"                │
│  → Si paga → todo sigue funcioniendo                            │
│  → Si no paga → bot se pausa, dashboard muestra "Activar plan"  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Demo Without VPS (Options)

### Opción A: Demo Hosted (más trabajo inicial)
- Usuario accede a bot corriendo en nuestra infra
- Conectado a cuenta demo Infinox pública
- Todos ven los mismos trades

### Opción B: Bot Demo Simplificado
- Ejecutable .exe que corre en PC del usuario
- Se conecta a su cuenta demo Infinox
- No requiere VPS

### Opción C: Canal Telegram Público (RECOMENDADA)
- Bot operando en cuenta demo pública
- Canal Telegram con señales y trades en tiempo real
- Zero friction - solo unirse al canal
- Marketing automático con resultados reales

---

## 9. Pending Decisions

| # | Pregunta | Estado |
|---|----------|--------|
| 1 | Planes €57/147/347 | Propuesto, pendiente confirmar |
| 2 | Opción demo sin VPS | Pendiente decisión |
| 3 | Trial con plan PRO | Aprobado |
| 4 | 8 días gracia + 3 intentos pago fallido | Propuesto, pendiente confirmar |
| 5 | Usuarios existentes (Xisco) | Pendiente decisión |

---

## 10. Implementation Checklist

- [ ] Actualizar schema Prisma con campos Stripe
- [ ] Crear webhook endpoint `/api/stripe/webhook`
- [ ] Crear página de precios `/pricing`
- [ ] Crear checkout flow con Stripe
- [ ] Modificar `/api/bot/config` para verificar subscriptionStatus
- [ ] Crear emails automáticos (trial ending, payment failed, etc.)
- [ ] Crear billing portal para gestionar suscripción
- [ ] Tests de todo el flujo

---

*Documentado: 2026-02-26*
*Última actualización: 2026-02-26*
