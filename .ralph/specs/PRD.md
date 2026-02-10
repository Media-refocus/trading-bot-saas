# PRD - Trading Bot SaaS

> **Fecha**: 2025-02-10
> **Versión**: 1.0
> **Cliente**: Xisco → Producto SaaS para venta

---

## Resumen Ejecutivo

Plataforma SaaS multi-tenant que permite a clientes de trading automatizar la replicación de señales de trading desde canales de Telegram hacia exchanges centralizados (Binance, Bybit, etc).

**Modelo de negocio**: Suscripción mensual con tiers de funcionalidad.

---

## Usuarios

### 1. Cliente Final (Trader)
- Quiere automatizar sus trades siguiendo señales de expertos en Telegram
- No tiene conocimientos técnicos avanzados
- Necesita control sobre riesgo (stop-loss, position sizing)

### 2. Admin (Plataforma)
- Gestiona clientes
- Monitoriza salud del sistema
- Gestiona planes y precios

---

## Features Core

### 1. Conexión con Telegram
- **Input**: URL de canal de Telegram o invitación al bot
- **Función**: Escuchar mensajes nuevos con señales de trading
- **Formato de señal**: Parsear formatos comunes (ej: "BTC/USDT BUY @ 45000 SL 44500 TP 46000")
- **Validación**: Confirmar formato antes de ejecutar

### 2. Integración con Exchanges
- **Exchanges soportados**: Binance (primero), Bybit (v2)
- **Autenticación**: API Key + Secret (encriptados en BD)
- **Permisos mínimos**: Solo trading, NO retiradas
- **Validación**: Test connection antes de guardar

### 3. Ejecución de Órdenes
- **Replicación automática**:
  - Leer señal de Telegram
  - Calcular position size según configuración del usuario
  - Ejecutar orden en el exchange
  - Registrar en BD
- **Tipos de orden**: Market, Limit
- **Risk management**:
  - Stop-loss por posición
  - Take-profit por posición
  - Max position size (% del portfolio)
  - Max posiciones abiertas simultáneas

### 4. Gestión de Posiciones
- **Monitorización en tiempo real**
- **Cierre manual** desde dashboard
- **Cierre automático** por SL/TP
- **Historial de trades**: PnL, fechas, screenshots

---

## Dashboard Cliente

### Página Principal: Trading Overview
```
┌─────────────────────────────────────────────────┐
│  Portfolio Total: $12,450  PnL Hoy: +$234 (+1.8%)│
├─────────────────────────────────────────────────┤
│  Open Positions                    Closed Today  │
│  ┌─────────────────────┐         ┌──────────┐   │
│  │ BTC/USDT LONG       │         │ BTC: +$120│   │
│  │ Entry: $45,234      │         │ ETH: +$45 │   │
│  │ Current: $45,678    │         └──────────┘   │
│  │ PnL: +$444 (+0.98%) │                          │
│  │ SL: $44,900         │                          │
│  │ TP: $46,500         │                          │
│  └─────────────────────┘                          │
└─────────────────────────────────────────────────┘
```

### Settings
- **Exchange Configuration**
  - API Key (maskeada: `****...abcd`)
  - Secret (solo se muestra al crear, nunca al editar)
  - Exchange selector (Binance, Bybit)

- **Telegram Configuration**
  - Canal ID o URL
  - Bot token (si es necesario)

- **Risk Management**
  - Position size default (% del portfolio)
  - Max positions open
  - Default SL (%)
  - Default TP (%)

---

## Dashboard Admin

### Métricas Globales
- Total de tenants
- Total de trades ejecutados (hoy, semana, mes)
- Revenue (MRR, ARR)
- Errores del bot por tenant

### Gestión de Tenants
- Ver config de cada cliente
- Desactivar/reactivar tenants
- Ver logs de errores por tenant

---

## Base de Datos - Esquema Multi-tenant

```prisma
// PENDIENTE: Definir según specs del código existente
// Ejemplo de estructura:

model Tenant {
  id        String   @id
  name      String
  email     String   @unique
  stripeId  String?  @unique

  accounts  Account[]
  botConfigs BotConfig[]
  trades    Trade[]
  createdAt DateTime @default(now())
}

model BotConfig {
  id              String   @id
  tenantId        String
  tenant          Tenant   @relation

  exchangeType    String   // Binance, Bybit
  apiKey          String   @encrypted
  apiSecret       String   @encrypted

  telegramChannel String?
  telegramBotId   String?

  positionSize    Float    @default(1.0) // % del portfolio
  maxPositions    Int      @default(5)
  defaultSL       Float?   // %
  defaultTP       Float?   // %

  enabled         Boolean  @default(true)
}

model Trade {
  id          String    @id
  tenantId    String
  tenant      Tenant    @relation

  symbol      String    // BTC/USDT
  side        String    // BUY/SELL
  type        String    // MARKET/LIMIT
  entryPrice  Float
  quantity    Float

  stopLoss    Float?
  takeProfit  Float?

  status      String    // OPEN, CLOSED, ERROR
  exitPrice   Float?
  pnl         Float?

  signalSource String   // Telegram channel ID
  signalData   Json?    // Raw signal message

  openedAt    DateTime  @default(now())
  closedAt    DateTime?
}
```

---

## Planes y Precios

| Plan | Precio | Max Positions | Exchanges | Priority Support |
|------|--------|---------------|-----------|------------------|
| Basic | $49/mes | 3 | Binance | ❌ |
| Pro | $99/mes | 10 | Binance + Bybit | ✅ |
| Enterprise | $299/mes | ∞ | All exchanges | ✅ (+ dedicated) |

---

## Requisitos No Funcionales

### Seguridad
- ✅ API keys encriptadas en reposo (PostgreSQL pgcrypto o similar)
- ✅ HTTPS obligatorio en producción
- ✅ Rate limiting en APIs
- ✅ Logs de auditoría de acciones críticas

### Fiabilidad
- ✅ Bot nunca debe parar (cola de mensajes si API falla)
- ✅ Retry logic con exponential backoff
- ✅ Health checks cada 30s
- ✅ Alertas si bot cae (PagerDuty o similar)

### Performance
- ✅ Tiempo de respuesta dashboard < 200ms
- ✅ Señal de Telegram → orden ejecutada < 5s (p99)

### Escalabilidad
- ✅ Arquitectura multi-tenant desde day 1
- ✅ DB connection pooling
- ✅ Cache de datos frecuentes (Redis)

---

## Tech Stack (Confirmar)

### Frontend + Backend
- **Framework**: Next.js 14 (App Router)
- **UI**: shadcn/ui + Tailwind CSS
- **State**: React Query / Zustand
- **Forms**: React Hook Form + Zod

### Backend
- **API**: tRPC (type-safe) o Next.js API Routes
- **Auth**: NextAuth.js v5 (Auth.js)
- **DB**: PostgreSQL + Prisma ORM

### Bot
- **Language**: Python (FastAPI) o Node.js
- **Telegram**: Telethon (Python) o gram.js (Node)
- **Exchange**: ccxt library (soporta múltiples exchanges)

### Infra
- **Hosting**: Vercel (web) + Railway/DO (bot)
- **DB**: Supabase o Neon (serverless Postgres)
- **Queue**: Redis/BullQueue o PostgreSQL como queue
- **Monitoring**: Sentry (errors) + LogRocket (sessions)

---

## Pendiente de Definir

> **Coloca aquí la info del código existente**:
>
> - [ ] ¿Qué exchange usa actualmente?
> - [ ] ¿Qué librería de Telegram usa?
> - [ ] ¿Cómo parsea las señales? ¿Formato específico?
> - [ ] ¿Cómo gestiona el risk management?
> - [ ] ¿Algún edge case importante que haya encontrado?
>
> **Revisar código existente en `codigo-existente/`**

---

## Roadmap

### Sprint 1 (Semanas 1-2): Foundation
- Setup proyecto
- DB multi-tenant
- Auth básico

### Sprint 2 (Semanas 3-4): Core Bot
- Migrar lógica del bot
- Integración exchange
- Integración Telegram

### Sprint 3 (Semanas 5-6): Dashboard Cliente
- UI completa
- Configuración exchange/Telegram
- Monitorización de posiciones

### Sprint 4 (Semanas 7-8): Pagos + Polish
- Stripe integration
- Onboarding flow
- Testing + Deploy

---

## Success Metrics

- **Tiempo para primer trade**: < 15 min desde registro
- **Uptime del bot**: > 99.5%
- **Churn rate**: < 5% mensual
- **NPS**: > 50
