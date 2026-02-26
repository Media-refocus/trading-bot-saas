# Trading Bot SaaS - Planes y Precios

## Precios

| Plan | Precio | Público objetivo |
|------|--------|------------------|
| Básico | €57/mes | Traders individuales |
| Pro | €147/mes | Traders serios con múltiples cuentas |
| Enterprise | €347/mes | Profesionales e instituciones |

---

## Comparativa de Features

| Feature | Básico €57 | Pro €147 | Enterprise €347 |
|---------|------------|----------|-----------------|
| **Cuentas MT5** | 1 | 3 | Ilimitadas |
| **Bot señales XAUUSD** | ✓ | ✓ | ✓ |
| **Dashboard básico** | ✓ | ✓ | ✓ |
| **Heartbeat monitoring** | ✓ | ✓ | ✓ |
| **Soporte email** | ✓ | ✓ | ✓ |
| **Notificaciones Telegram** | - | ✓ | ✓ |
| **Dashboard avanzado** | - | ✓ | ✓ |
| **Exportar CSV/PDF** | - | ✓ | ✓ |
| **Soporte prioritario 24h** | - | ✓ | ✓ |
| **Multi-símbolo** | - | - | ✓ |
| **Backtester integrado** | - | - | ✓ |
| **API access** | - | - | ✓ |
| **SLA 99.9% uptime** | - | - | ✓ |
| **Soporte dedicado + call** | - | - | ✓ |

---

## Detalle por Plan

### 🥉 Básico - €57/mes

**Para:** Traders individuales que quieren automatizar señales de XAUUSD

**Incluye:**
- 1 cuenta MT5
- Bot de señales XAUUSD
- Dashboard básico:
  - Ver trades abiertos y cerrados
  - P&L total y diario
  - Win rate básico
- Monitoreo de estado del bot (online/offline)
- Soporte por email (48h respuesta)

**Límites:**
- Solo XAUUSD
- Sin Telegram
- Sin exportación de datos

---

### 🥈 Pro - €147/mes

**Para:** Traders serios que quieren más control y visibilidad

**Incluye todo lo de Básico +:**
- 3 cuentas MT5
- Notificaciones Telegram:
  - Trade abierto/cerrado
  - Señales recibidas
  - Alertas del sistema
  - Comandos: /status, /pause, /resume
- Dashboard avanzado:
  - Gráficos de equity
  - Estadísticas detalladas
  - Historial completo
- Exportar datos en CSV y PDF
- Soporte prioritario (respuesta en 24h)

**Límites:**
- Solo XAUUSD
- Máximo 3 cuentas

---

### 🥇 Enterprise - €347/mes

**Para:** Profesionales, gestores de capital e instituciones

**Incluye todo lo de Pro +:**
- Cuentas MT5 ilimitadas
- Multi-símbolo:
  - XAUUSD
  - EURUSD
  - GBPUSD
  - USDJPY
  - (Más según demanda)
- Backtester integrado:
  - Probar estrategias antes de operar
  - Optimización de parámetros
  - Reportes de rendimiento
- API access:
  - Webhooks para integraciones
  - Acceso programático a datos
  - Automatizaciones custom
- SLA 99.9% uptime garantizado
- Soporte dedicado:
  - Respuesta en 4h
  - Call mensual de revisión
  - Configuración asistida

---

## Trial

**Duración:** 14 días

**Plan durante trial:** PRO completo

**Por qué PRO en trial:**
- El usuario ve todas las features (Telegram, gráficos, etc.)
- Genera "hook emocional" - no quiere perder el Telegram
- Mayor conversión a planes de pago

**Cuando expira:**
- Usuario elige plan → continúa con features de ese plan
- No elige plan → bot pausado, dashboard muestra opciones

---

## Descuentos

| Período | Descuento |
|---------|-----------|
| Trimestral | 10% |
| Anual | 20% |

**Ejemplo Pro anual:** €147 × 12 × 0.80 = €1,411/año (€235 ahorro)

---

## Migración de Planes

### Upgrade
- Inmediato
- Prorrateo automático
- Nuevas features disponibles al instante

### Downgrade
- Efectivo al siguiente período de facturación
- Features actuales se mantienen hasta entonces
- Email de confirmación

### Cancelación
- Efectivo al final del período pagado
- Datos retenidos 30 días
- Reactivación sin pérdida de datos

---

## Límites Técnicos por Plan

```typescript
const PLAN_LIMITS = {
  basic: {
    maxAccounts: 1,
    telegramEnabled: false,
    backtestEnabled: false,
    multiSymbol: false,
    apiAccess: false,
    supportLevel: 'email',
    maxHistoryDays: 30,
  },
  pro: {
    maxAccounts: 3,
    telegramEnabled: true,
    backtestEnabled: false,
    multiSymbol: false,
    apiAccess: false,
    supportLevel: 'priority',
    maxHistoryDays: 90,
  },
  enterprise: {
    maxAccounts: Infinity,
    telegramEnabled: true,
    backtestEnabled: true,
    multiSymbol: true,
    apiAccess: true,
    supportLevel: 'dedicated',
    maxHistoryDays: 365,
  },
};
```

---

## FAQs

**¿Puedo cambiar de plan?**
Sí, puedes hacer upgrade o downgrade en cualquier momento.

**¿Qué pasa si añado más cuentas de las permitidas?**
El dashboard te avisará y no podrás añadir más hasta hacer upgrade.

**¿El trial requiere tarjeta de crédito?**
No, el trial es sin tarjeta. Solo la pides cuando quiere activar el plan.

**¿Puedo pausar mi suscripción?**
Sí, puedes pausar hasta 3 meses al año sin perder datos.

---

*Precios actualizados: 2026-02-26*
