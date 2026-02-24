# Roadmap - Bot de Operativa SaaS

> Estado: 2026-02-24
> Objetivo: Sistema completo para que clientes operen automáticamente siguiendo señales de Telegram

---

## FASE 1: Fundamentos ✅ COMPLETADA

| Feature | Estado | Commit |
|---------|--------|--------|
| Bot Python MT5 | ✅ | f0cf583 |
| Ingestor Telegram | ✅ | 25011fb |
| API del SaaS (auth, signals, heartbeat) | ✅ | b679392 |
| Provisioning VPS | ✅ | f8b5c58 |
| Página Setup con descarga scripts | ✅ | 4c48efa |
| Dashboard con estado del bot | ✅ | 78c3bd6 |

---

## FASE 2: Configuración desde el SaaS ⏳ ACTUAL

### 2.1 Página de Configuración del Bot
**Prioridad:** ALTA
**Objetivo:** Permitir que el usuario configure su bot desde el SaaS web

**Tasks:**
- [ ] Página `/settings` con formulario de configuración
- [ ] Guardar config en BotConfig (Prisma)
- [ ] API `GET/PUT /api/bot/config` para leer/guardar
- [ ] Bot lee config del SaaS al iniciar y periódicamente
- [ ] Validación de límites según plan

**Campos a configurar:**
```yaml
Trading:
  - lotSize: 0.01 - 1.0
  - maxLevels: 1 - 5
  - gridDistance: 5 - 50 pips
  - takeProfit: 10 - 100 pips

Gestión de Riesgo:
  - stopLoss: 0 (disabled) - 200 pips
  - trailingActivate: 0 - 100 pips
  - trailingStep: 5 - 50 pips
  - trailingBack: 10 - 100 pips

Restricciones:
  - allowPromedios: true/false
  - maxPromedios: 0 - 3
  - riskMode: normal/conservativo/agresivo
```

### 2.2 Estado Detallado del Bot
**Prioridad:** MEDIA

**Tasks:**
- [ ] API `/api/bot/status` con info completa
- [ ] Mostrar posiciones abiertas en dashboard
- [ ] Historial de operaciones reciente
- [ ] Métricas: operaciones hoy, profit, drawdown

---

## FASE 3: Monitoreo y Alertas

### 3.1 Logs del Bot en Tiempo Real
**Prioridad:** MEDIA

**Tasks:**
- [ ] Bot envía logs al SaaS
- [ ] WebSocket para streaming de logs
- [ ] Página `/logs` para ver en tiempo real
- [ ] Filtros por nivel (info, warning, error)

### 3.2 Alertas
**Prioridad:** MEDIA

**Tasks:**
- [ ] Notificaciones cuando bot se desconecta
- [ ] Alertas de drawdown alto
- [ ] Email cuando hay errores críticos
- [ ] Integración con Telegram del usuario

---

## FASE 4: Multi-Tenant y Pagos

### 4.1 Planes y Límites
**Prioridad:** ALTA (para monetizar)

**Tasks:**
- [ ] Model Plan en Prisma con límites
- [ ] Middleware para verificar límites
- [ ] Bloquear features según plan
- [ ] Upgrade/downgrade de plan

**Planes propuestos:**
| Plan | Precio | Max niveles | Max posiciones | Soporte |
|------|--------|-------------|----------------|---------|
| Básico | $49/mes | 3 | 1 | Email |
| Pro | $99/mes | 5 | 3 | Priority |
| Enterprise | $249/mes | Ilimitado | Ilimitado | Dedicado |

### 4.2 Integración Stripe
**Prioridad:** ALTA

**Tasks:**
- [ ] Productos y precios en Stripe
- [ ] Checkout para suscripción
- [ ] Webhooks para eventos de pago
- [ ] Gestión de suscripciones
- [ ] Página de pricing

---

## FASE 5: Mejoras del Bot

### 5.1 Soporte MT4
**Prioridad:** MEDIA

**Tasks:**
- [ ] Adaptar bot para MT4
- [ ] Detectar versión instalada automáticamente
- [ ] Documentación específica MT4

### 5.2 Modo Paper Trading
**Prioridad:** BAJA

**Tasks:**
- [ ] Flag para modo simulación
- [ ] No ejecutar órdenes reales
- [ ] Tracking de P&L virtual
- [ ] Útil para testing antes de operar real

### 5.3 Multi-Símbolo
**Prioridad:** BAJA

**Tasks:**
- [ ] Soportar otros pares además de XAUUSD
- [ ] Configuración por símbolo
- [ ] Distribución de capital

---

## FASE 6: Testing y Producción

### 6.1 Tests
**Prioridad:** MEDIA

**Tasks:**
- [ ] Tests unitarios del bot
- [ ] Tests de integración API
- [ ] Tests E2E del flujo completo
- [ ] CI/CD con GitHub Actions

### 6.2 Deploy
**Prioridad:** ALTA

**Tasks:**
- [ ] Configurar VPS de producción
- [ ] Dominio y SSL
- [ ] Monitoreo con Uptime Robot
- [ ] Backups automáticos

---

## Orden de Implementación (Próximas Sessions)

1. **Settings Page** - Configuración del bot desde web
2. **API Config** - Endpoints para leer/guardar config
3. **Bot lee config del SaaS** - Sincronización
4. **Estado detallado** - Posiciones y métricas
5. **Planes y límites** - Modelos y middleware
6. **Stripe** - Pagos
7. **Deploy** - Producción

---

## Notas para Claude

- **Siempre hacer commit** después de cada feature
- **Push a GitHub** al terminar cada sesión
- **Actualizar este archivo** cuando se complete algo
- **Un feature = un commit** (o varios si es grande)
- **Mensajes en español** en commits
