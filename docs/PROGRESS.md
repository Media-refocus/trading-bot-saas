# Trading Bot SaaS - Progreso del Proyecto

## Estado Actual: MVP Funcional

Fecha última actualización: 2026-02-26

---

## Completado

### Autenticación
- [x] NextAuth.js v5 configurado
- [x] Login con email/password
- [x] Registro de usuarios
- [x] Middleware de protección de rutas
- [x] tRPC protectedProcedure
- [x] Multi-tenant con tenantId en sesión

### API Backend
- [x] tRPC router para bot
- [x] Endpoints REST para bot Python:
  - [x] GET /api/bot/config - Obtener configuración
  - [x] POST /api/bot/heartbeat - Heartbeat del bot
  - [x] POST /api/bot/signal - Reportar señal
  - [x] POST /api/bot/trade/open - Abrir trade
  - [x] POST /api/bot/trade/close - Cerrar trade
- [x] Validación de API key con bcrypt
- [x] Aislamiento multi-tenant

### Bot Python
- [x] Cliente SaaS (saas_client.py)
- [x] Integración con MT5
- [x] Bot operativo (bot_operativo.py)
- [x] Telegram bot para notificaciones
- [x] Test de conexión con SaaS

### Dashboard
- [x] Página de monitor del bot
- [x] Tarjetas de estadísticas (P&L, Win Rate, Trades, Today)
- [x] Exportación CSV de trades
- [x] Configuración de bot

### Infraestructura
- [x] Script de provisioning VPS (PowerShell)
- [x] Documentación de setup

### Tests
- [x] 13 tests del API del bot
- [x] Global setup para test database

---

## Pendiente

### Stripe (Prioridad cuando todo funcione)
- [ ] Actualizar schema Prisma
- [ ] Webhook endpoint
- [ ] Página de precios
- [ ] Checkout flow
- [ ] Billing portal
- [ ] Emails automáticos
- [ ] Verificación de suscripción en API

### Mejoras Dashboard
- [ ] Gráficos de equity
- [ ] Más estadísticas
- [ ] Configuración de Telegram en UI
- [ ] Wizard de onboarding

### Tests
- [ ] Tests de autenticación
- [ ] Tests de endpoints protegidos
- [ ] Tests de multi-tenant

### Deploy
- [ ] Configurar Vercel
- [ ] Migrar a Postgres (opcional)
- [ ] Variables de entorno producción

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                     ARQUITECTURA                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │   CLIENTE   │     │    SAAS     │     │   TELEGRAM  │   │
│  │   (VPS)     │     │  (Vercel)   │     │  (Canal)    │   │
│  │             │     │             │     │             │   │
│  │  ┌───────┐  │     │  ┌───────┐  │     │  Señales    │   │
│  │  │ MT5   │◄─┼────►│  │ Next  │  │     │  entrada    │   │
│  │  └───────┘  │ API │  │  JS   │  │     │             │   │
│  │  ┌───────┐  │     │  └───────┘  │     └─────────────┘   │
│  │  │ Python│◄─┼────►│  ┌───────┐  │                       │
│  │  │  Bot  │  │     │  │ tRPC  │  │                       │
│  │  └───────┘  │     │  └───────┘  │                       │
│  │  ┌───────┐  │     │  ┌───────┐  │                       │
│  │  │Telegra│◄─┼─────┼─►│Prisma │  │                       │
│  │  │  Bot  │  │     │  │ SQLite│  │                       │
│  │  └───────┘  │     │  └───────┘  │                       │
│  └─────────────┘     └─────────────┘                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Commits Recientes

| Fecha | Commit | Descripción |
|-------|--------|-------------|
| 2026-02-26 | c1402ee | Autenticación completa en router bot |
| 2026-02-26 | - | Docs Stripe y planes |
| 2026-02-26 | - | Telegram bot integration |
| 2026-02-26 | - | Bot-SaaS connection tests |
| 2026-02-26 | - | Dashboard stats y CSV export |
| 2026-02-26 | - | VPS provisioning scripts |

---

## Stack Tecnológico

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** tRPC v11, Prisma ORM
- **Database:** SQLite (dev), Postgres (prod recomendado)
- **Auth:** NextAuth.js v5 beta
- **Payments:** Stripe (pendiente)
- **Bot:** Python 3.11, MetaTrader5, python-telegram-bot

---

## Decisiones de Diseño

1. **Multi-tenant con tenantId:** Cada query filtra por tenantId
2. **API key con bcrypt:** Hash seguro, validación en cada request
3. **Telegram integrado en bot Python:** Notificaciones y comandos
4. **Trial de 14 días con plan PRO:** Hook emocional para conversión
5. **8 días de gracia en pago fallido:** 3 intentos antes de pausar

---

*Documento vivo - actualizar con cada sesión*
