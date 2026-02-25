# Trading Bot SaaS - Estado Actual
**Última actualización:** 26 Feb 2026

---

## 📁 Repositorio
```
C:\Users\guill\Projects\trading-bot-saas-bot
Branch: feature/bot-operativa
```

---

## ✅ COMPLETADO

### 1. Sistema de Planes (EUR)
| Plan | Precio | Posiciones | Niveles | Fee Implementación |
|------|--------|------------|---------|-------------------|
| Starter | 57€/mes | 1 | 2 | +97€ |
| Trader | 97€/mes | 3 | 4 | Incluido |
| Pro | 197€/mes | 5 | 6 | Incluido |
| Enterprise | 497€/mes | 10 | 10 | Incluido |

### 2. Sistema de Onboarding
- Página `/onboarding` con 5 pasos
- APIs: `/api/onboarding/status`, `/api/onboarding/vps`, `/api/onboarding/mt5`

### 3. Soporte MT4 (EA Receptor)
- EA `BotOperativaReceiver.mq4` (~400 líneas)
- 5 APIs de comunicación con validación de suscripción

### 4. Validación de Suscripción Activa
- Función `validateMt4Access()` en `lib/plans.ts`
- Códigos: 401 (auth), 403 (revocado), 402 (sin pago)

### 5. Integración Stripe Completa (NUEVO 26 Feb)
| Archivo | Descripción |
|---------|-------------|
| `lib/stripe.ts` | Helper con checkout, portal, webhooks |
| `app/api/stripe/checkout/route.ts` | Crear sesión de pago |
| `app/api/stripe/webhook/route.ts` | Recibir eventos de Stripe |
| `app/api/stripe/portal/route.ts` | Portal de cliente |

**Eventos manejados:**
- `checkout.session.completed` → Activar plan
- `customer.subscription.updated` → Cambios de estado
- `customer.subscription.deleted` → Revocar acceso
- `invoice.payment_failed` → Alertas

### 6. Soporte MT5 (API Oficial)
- Librería `MetaTrader5` Python
- Conexión directa sin instalación del usuario

---

## 🔄 PENDIENTE

### Prioridad Alta
| Tarea | Descripción | Esfuerzo |
|-------|-------------|----------|
| ~~Stripe Integration~~ | ✅ Completado | - |
| Compilar EA a .ex4 | El usuario necesita el archivo compilado | 5 min |
| Configurar Stripe Dashboard | Crear productos/precios, configurar webhook | 30 min |

### Prioridad Media
| Tarea | Descripción |
|-------|-------------|
| Encriptación credenciales | VPS y MT5 en texto plano |
| Testing EA | Probar en cuenta demo MT4 |
| Testing pagos Stripe | Probar flujo completo end-to-end |

### Prioridad Baja
| Tarea | Descripción |
|-------|-------------|
| Documentación usuario | PDF con instrucciones |
| PWA | Convertir a app instalable |

---

## 🏗️ Arquitectura de Pagos

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO DE PAGO STRIPE                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  Usuario hace click en plan   │
              └───────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  POST /api/stripe/checkout    │
              │  → Crea sesión de Stripe      │
              └───────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  Redirige a Stripe Checkout   │
              │  (pago con tarjeta)           │
              └───────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  Stripe envía webhook         │
              │  POST /api/stripe/webhook     │
              └───────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  Actualiza DB:                │
              │  - Tenant.planId              │
              │  - Subscription.status        │
              │  - implementationFeePaid      │
              └───────────────────────────────┘
```

---

## 📋 Commits de la Sesión
```
101fe98 feat: integración completa de Stripe para pagos
c25f272 feat: validación de suscripción activa en APIs MT4
```

---

## 🚀 Comandos Rápidos
```bash
cd /c/Users/guill/Projects/trading-bot-saas-bot
npm run dev          # Arrancar dev server
npm run build        # Build producción
git log --oneline -5  # Ver commits
```

---

## 🔧 Configuración Stripe (Pendiente)

1. **Crear cuenta Stripe** → Obtener keys
2. **Configurar .env.local:**
   ```
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_xxx
   STRIPE_SECRET_KEY=sk_xxx
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```
3. **Configurar webhook en Stripe Dashboard:**
   - URL: `https://bot.refuelparts.com/api/stripe/webhook`
   - Eventos: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`

---

## 💰 Contrato Xisco (Referencia)
- Precio base: 57€/mes
- Implementación: 97€
- Reparto comunidad: 60% Agencia / 40% Xisco
- Ventas fuera: 100% Agencia

---

## 🔗 URLs Importantes
- Repo: `feature/bot-operativa` branch
- SaaS (prod): https://bot.refuelparts.com
- Stripe Dashboard: https://dashboard.stripe.com
