# PRD - Bot de Trading Xisco (MT4/MT5)

> **Fecha**: 2025-02-10
> **Versión**: 2.0 (Actualizado con specs reales)
> **Cliente**: Xisco → Producto SaaS para venta
> **Mercado**: Forex/CFDs (XAUUSD principal)

---

## Resumen Ejecutivo

Sistema automático de replicación de operativa real basada en señales enviadas por Telegram, con ejecución en MetaTrader 4/5.

**El producto final permite:**
- A la gente operar de manera autónoma mientras hace otras cosas
- Seguir las señales que da Xisco en su canal de Telegram
- Configurar según capital, riesgo y tipo de cuenta
- Backtesting fiable para validar la operativa histórica

**Modelo de negocio**: SaaS multi-tenant con suscripción mensual.

---

## 1. Cómo Funciona la Operativa

### 1.1 Flujo Principal

```
┌─────────────────────────────────────────────────────────────┐
│  CANAL DE TELEGRAM (Xisco)                                  │
├─────────────────────────────────────────────────────────────┤
│  Señales que detecta el bot:                                │
│  • Entradas: "BUY XAUUSD 3015", "SELL 3029"                 │
│  • Modificaciones: "SL +10", "Movemos SL a BE"              │
│  • Advertencias: "RIESGO", "SIN PROMEDIOS", "SOLO 1 PROMEDIO"│
│  • Cierres: "CERRAMOS TODO", "CERRAMOS PROMEDIO"            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  BOT PYTHON - LISTENER (Telethon)                           │
├─────────────────────────────────────────────────────────────┤
│  • Escucha canal 24/7                                       │
│  • Parsea mensajes según semántica                          │
│  • Detecta intención: entrada, SL, TP, cierre               │
│  • Maintains estado: operación activa, promedios, restricciones│
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  MOTOR DE DECISIÓN (Lógica Operativa)                        │
├─────────────────────────────────────────────────────────────┤
│  1. Apertura base:                                          │
│     - L00 / S00 (posición inicial)                          │
│     - Lote según calculadora de riesgo                      │
│                                                              │
│  2. Sistema de promedios (grid):                            │
│     - Máximo 4 operaciones (1 base + 3 promedios)           │
│     - Distancias: -30, -60, -90 pips (1 pip = 0.10 XAUUSD)  │
│     - Dinámico según restricciones del canal:               │
│       * RIESGO → solo 1 promedio                            │
│       * SIN PROMEDIOS → 0                                   │
│       * Sin mensaje → 3 por defecto                         │
│                                                              │
│  3. Gestión SL dinámica:                                    │
│     - +60 pips → SL a BE +20                                │
│     - +90 pips → SL a BE +50                                │
│     - Sin BE en +40 (eliminado)                             │
│                                                              │
│  4. Cierres:                                                │
│     - CERRAMOS TODO → cierra todas las posiciones           │
│     - CERRAMOS PROMEDIO → cierra solo promedios             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  EJECUTOR MT4/MT5 (API MetaTrader)                          │
├─────────────────────────────────────────────────────────────┤
│  • Conecta con terminal MT4 o MT5 del cliente               │
│  • Ejecuta órdenes market/limit                             │
│  • Modifica SL/TP de posiciones abiertas                    │
│  • Cierra posiciones (total o parcial)                      │
│  • Monitoriza estado de posiciones en tiempo real           │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Tipos de Cuenta Soportados

| Broker | Tipo de Cuenta | Símbolo XAUUSD | Descripción |
|--------|----------------|----------------|-------------|
| VT Markets | Cuenta Cent | XAUUSD (lote estándar) | 1 lote = 100k, cent accounts |
| Infinox | Cuenta Microlote | XAUUSD microlote | Simula cent accounts para capital pequeño |

**Calculadora de riesgo se adapta a:**
- Capital disponible
- Riesgo por operativa (% del capital)
- Tipo de cuenta (cent vs estándar vs microlote)

---

## 2. Estado Actual del Sistema

### ✅ MUY BIEN CONSTRUIDO

| Componente | Estado | Detalles |
|------------|--------|----------|
| Listener Telegram | ✅ Implementado | Telethon, sesión persistente, escucha continua |
| Parser Semántico | ✅ Implementado | Detecta entradas, SL, riesgos, cierres |
| Sistema de Promedios | ✅ Implementado | Grid dinámico según restricciones del canal |
| Gestión SL Avanzada | ✅ Implementado | BE+20, BE+50, sin BE prematuro |
| Ejecutor MT5 | ✅ Implementado | API MT5, órdenes market, modificaciones |

### ⚠️ A MEDIAS

| Componente | Estado | Problema |
|------------|--------|----------|
| Gestión Estado Persistente | ⚠️ Frágil | Reinicios manuales (Ctrl+C) conservan restricciones |
| Cierres Automáticos Promedios | ⚠️ Parcial | Qué pasa si se reabre automáticamente |
| Soporte MT4 | ❌ Falta | Solo MT5 implementado |

### ❌ FALTANTE

| Componente | Estado | Detalles |
|------------|--------|----------|
| Normalizador Señales Históricas | ❌ No existe | CSV no distingue apertura/modificación/cierre |
| Backtester Completo | ❌ No existe | Solo EA MQL5 base + CSV con señales |
| Regla Cierre Histórico | ❌ Sin definir | Cierre al cambiar bias o al range_close |
| Calculadora de Riesgo | ⚠️ Parcial | No se adapta a capital/cuenta automáticamente |
| Web Dashboard | ❌ No existe | Solo scripts Python |

---

## 3. Backtester - Prioridad #1

### 3.1 Objetivo

Crear un backtester **fiable y realista** que permita validar la operativa histórica del canal.

### 3.2 Qué Tenemos

- ✅ **Historial de señales** del canal de Telegram (exportado)
- ✅ **Script procesador** que identifica puntos de entrada y cierre
- ✅ **EA MQL5 base** que reproduce operativa en MT5
- ✅ **Formato CSV**: `ts_utc;kind;side;price_hint`

### 3.3 Problema Principal

**El CSV no distingue bien:**
- Apertura real vs modificación
- Cierre explícito vs implícito
- Cambios de bias sin cierre formal

**Resultado**: Backtest no era fiable.

### 3.4 Solución Propuesta

#### Normalizador de Señales Históricas

```python
# datos/historical_signals/
├── raw_telegram_export.json          # Export crudo del canal
├── normalized_signals.csv            # Señales normalizadas
└── signal_processor.py              # Script de normalización

# formato normalized_signals.csv:
timestamp;signal_type;side;price;grid_level;restrictions;context
2024-01-15 08:30:00;ENTRY;BUY;3015.0;L00;[];new_bias
2024-01-15 08:35:12;MODIFICATION;BUY;3012.5;L10;["RIESGO"];sl_adjusted
2024-01-15 09:15:00;CLOSE;BUY;3025.0;ALL;[];manual_close
```

**Reglas de normalización:**
1. **ENTRY** → Primera señal de un nuevo rango/grid
2. **MODIFICATION** → Cambio de SL, TP, o restricción
3. **CLOSE** → Cierre total o parcial
4. **CONTEXT** → Bias previo, cambio de tendencia, etc.

#### Regla Canónica de Cierre Histórico

**Opción A (preferida)**: Cierre al siguiente cambio de bias
```
BUY 3015 → (operación abierta) → SELL 3020 → (se cierra BUY y se abre SELL)
```

**Opción B**: Cierre al range_close (cuando el canal indica cierre total manualmente)

**Opción C (híbrida)**: Opción A + Opción B, lo que ocurra primero

### 3.5 Métricas a Extraer

El backtester debe generar:

```
=== RESUMEN BACKTEST (Ejemplo) ========================
Periodo:                    2024-01-01 → 2024-12-31
Total operaciones:          127
Win rate:                   64.5%
Profit factor:              1.82
DD máximo:                  -12.3%
Profit neto:                +$4,567
Promedios por operación:    2.3 avg
Max drawdown duration:      14 días
Mejor racha ganadora:       8 operaciones
Peor racha perdedora:       3 operaciones
======================================================
```

---

## 4. Calculadora de Riesgo - Prioridad #2

### 4.1 Inputs del Usuario

```yaml
Capital:                     $500 (ejemplo)
Riesgo por operativa:        2% ($10 max)
Tipo de cuenta:              Infinox Microlote
Stop loss promedio:          30 pips
Max operaciones abiertas:    1
```

### 4.2 Cálculo de Lote

```
1. Riesgo máximo = Capital × (Riesgo% / 100)
   Ej: $500 × 0.02 = $10

2. Valor por pip = Riesgo máximo / SL en pips
   Ej: $10 / 30 = $0.33 por pip

3. Lote = Valor por pip / Valor del pip del símbolo
   • XAUUSD estándar: 1 pip = 0.01 → 1 lote = $10/pip
   • XAUUSD microlote: 1 pip = 0.01 → 0.01 lote = $0.10/pip

   Ej (microlote): $0.33 / $0.10 = 0.033 lotes
```

### 4.3 Adaptadores de Broker

```python
# Brokers soportados
BROKERS = {
    "vtmarkets": {
        "account_type": "cent",
        "symbol": "XAUUSD",
        "lot_multiplier": 1.0,        # 1 lote = 100k
        "pip_value": 10.0             # $10 por pip/lot
    },
    "infinox": {
        "account_type": "microlote",
        "symbol": "XAUUSDm",          # microlote symbol
        "lot_multiplier": 0.01,       # 0.01 lote = 1k
        "pip_value": 0.10             # $0.10 por pip/lot
    }
}
```

---

## 5. Arquitectura del Sistema Completo

### 5.1 Componentes

```
┌───────────────────────────────────────────────────────────────┐
│  WEB DASHBOARD (Next.js)                                       │
├───────────────────────────────────────────────────────────────┤
│  • Onboarding: capital, riesgo, broker, tipo cuenta           │
│  • Configuración: API MT4/MT5, canal Telegram                 │
│  • Monitorización: posiciones abiertas, PnL, histórico        │
│  • Calculadora de riesgo interactiva                          │
│  • Backtester: subir datos históricos, ver resultados         │
└───────────────────────────────────────────────────────────────┘
                              ↕ API REST
┌───────────────────────────────────────────────────────────────┐
│  BACKEND API (FastAPI / Node.js)                              │
├───────────────────────────────────────────────────────────────┤
│  • Auth: usuarios, sesiones                                    │
│  • Multi-tenant: aislamiento de clientes                      │
│  • Configuraciones: guardar/recuperar settings                │
│  • WebSocket: streaming de posiciones en vivo                 │
│  • Backtest service: ejecutar backtests                       │
└───────────────────────────────────────────────────────────────┘
                              ↕
┌───────────────────────────────────────────────────────────────┐
│  BOT ENGINE (Python)                                          │
├───────────────────────────────────────────────────────────────┐
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│  │ Telegram Listener│  │  Decision Engine │  │  MT4/5 Executor ││
│  │  (Telethon)     │  │  (Grid, SL, TP)  │  │   (API MetaTrader)││
│  └─────────────────┘  └─────────────────┘  └─────────────────┘│
│                              ↑                                 │
│  ┌─────────────────┐  ┌─────────────────┐                     │
│  │  State Manager  │  │ Risk Calculator │                     │
│  │  (Persistent)   │  │  (Adaptativo)   │                     │
│  └─────────────────┘  └─────────────────┘                     │
└───────────────────────────────────────────────────────────────┘
                              ↕
┌───────────────────────────────────────────────────────────────┐
│  TERMINAL MT4/MT5 (del cliente)                               │
├───────────────────────────────────────────────────────────────┤
│  • Terminal con API habilitada                                │
│  • Conectado a broker (VT Markets, Infinox, etc)              │
│  • Ejecuta órdenes del bot                                    │
└───────────────────────────────────────────────────────────────┘
```

### 5.2 Stack Tecnológico (Actualizado)

| Capa | Tecnología |
|------|------------|
| **Frontend** | Next.js 14 + shadcn/ui + Tailwind |
| **Backend** | FastAPI (Python) o Next.js API Routes |
| **Bot** | Python + Telethon + MetaTrader5 library |
| **Database** | PostgreSQL + Prisma (multi-tenant) |
| **MT4/5 Integration** | MetaTrader5 (Python) o API directa |
| **Backtester** | MQL5 EA + Python processor |
| **Auth** | NextAuth.js |
| **Payments** | Stripe |

---

## 6. Roadmap de Desarrollo

### FASE 1: Backtester Fiable (Semanas 1-2)
- [ ] Normalizador de señales históricas
- [ ] Definir regla canónica de cierre
- [ ] Script de procesamiento de CSV
- [ ] EA MQL5 mejorado con backtesting real
- [ ] Extraer métricas: DD, win rate, profit factor
- [ ] Validar con datos reales del canal

### FASE 2: Consolidar Bot (Semanas 3-4)
- [ ] Revisar código existente del bot
- [ ] Arreglar gestión de estado persistente
- [ ] Implementar reglas de cierre automático
- [ ] Soporte MT4 (además de MT5)
- [ ] Testing robusto de escenarios edge-case
- [ ] Logs completos de actividad

### FASE 3: Calculadora de Riesgo (Semana 5)
- [ ] Algoritmo adaptativo según capital
- [ ] Soporte multi-broker (VT Markets, Infinox)
- [ ] Detección automática de tipo de cuenta
- [ ] Validador de riesgo máximo por operación
- [ ] UI interactiva de configuración

### FASE 4: Dashboard Web (Semanas 6-8)
- [ ] Onboarding flow (capital, riesgo, broker)
- [ ] Configuración de MT4/5 connection
- [ ] Monitorización de posiciones en vivo
- [ ] Histórico de operaciones con PnL
- [ ] Backtesting integrado en la web
- [ ] Sistema de notificaciones

### FASE 5: Multi-tenant + Pagos (Semanas 9-10)
- [ ] Arquitectura multi-tenant
- [ ] Stripe integration
- [ ] Planes: Basic ($49), Pro ($99), Enterprise ($249)
- [ ] Gestión de suscripciones
- [ ] Landing page de ventas

### FASE 6: Testing + Deploy (Semanas 11-12)
- [ ] Tests E2E de flujos críticos
- [ ] Load testing del bot
- [ ] CI/CD setup
- [ ] Deploy a producción
- [ ] Monitoring + alerting

---

## 7. Planes y Precios

| Plan | Precio | Max Operaciones Simultáneas | Brokers | Backtesting | Priority Support |
|------|--------|----------------------------|---------|-------------|------------------|
| Basic | $49/mes | 1 | 1 broker | ✅ | ❌ |
| Pro | $99/mes | 3 | Ilimitados | ✅ + Avanzado | ✅ |
| Enterprise | $249/mes | Ilimitadas | Ilimitados | ✅ + Custom | ✅ (Dedicado) |

---

## 8. Pendiente de Definir

### Revisar con el código existente en `codigo-existente/`:

- [ ] **Estructura exacta de los scripts** del bot
- [ ] **Cómo se conecta a MT5** (librería, puertos, autenticación)
- [ ] **Formato exacto de las señales** del canal (ejemplos reales)
- [ ] **Restricciones dinámicas**: cómo se guardan y recuperan
- [ ] **Estado persistente**: qué se guarda y cómo
- [ ] **Edge cases encontrados**: qué problemas surgieron en producción

### Datos históricos del canal:

- [ ] **Ubicación del export** de mensajes de Telegram
- [ ] **Script que procesa** los puntos de entrada/cierre
- [ ] **Formato actual del CSV** generado
- [ ] **¿Qué gaps de información** hay en el histórico?

---

## 9. Success Metrics

### Backtester
- ✅ **Precisión**: >95% de coincidencia con operativa real
- ✅ **Velocidad**: Backtest de 1 año en <5 minutos
- ✅ **Métricas**: DD, win rate, profit factor, sharpe ratio

### Bot en Producción
- ✅ **Uptime**: >99% disponibilidad
- ✅ **Latencia**: Señal → Ejecución <3s (p95)
- ✅ **Cero pérdidas** por errores de ejecución

### Producto SaaS
- ✅ **Time-to-first-trade**: <15 minutos desde registro
- ✅ **Churn rate**: <5% mensual
- ✅ **NPS**: >50

---

## 10. Archivos Clave del Proyecto

```
trading-bot-saas/
├── codigo-existente/           # CÓDIGO ACTUAL DEL BOT
│   ├── bot_xisco.py            # [SUBIR] Script principal
│   ├── mt5_executor.py         # [SUBIR] Conexión MT5
│   ├── telegram_listener.py    # [SUBIR] Telethon listener
│   ├── signal_parser.py        # [SUBIR] Parser de señales
│   └── state_manager.py        # [SUBIR] Gestión de estado
│
├── docs/                        # DOCUMENTACIÓN
│   ├── formato-senales.md       # [CREAR] Formato exacto señales
│   ├── diagrama-flujo.md        # [CREAR] Flujo completo
│   ├── casos-edge.md            # [CREAR] Edge cases encontrados
│   └── datos-historicos/        # [SUBIR] Export del canal
│       ├── telegram_export.json
│       └── signals_raw.csv
│
├── .ralph/specs/
│   ├── PRD.md                   # Este documento
│   └── BACKTEST_SPECS.md        # [CREAR] Specs del backtester
│
└── README.md                    # Estructura del proyecto
```

---

## Próximos Pasos Inmediatos

1. **Subir código existente** a `codigo-existente/`
2. **Subir datos históricos** del canal a `docs/datos-historicos/`
3. **Lanzar Agente Explore** para analizar el código
4. **Crear BACKTEST_SPECS.md** con specs del normalizador
5. **Arrancar Ralph Loop** para implementación

---

## Notas Importantes

- **MT4 + MT5**: Es vital soportar ambos para captar máxima audiencia
- **Infinox microlotes**: Nueva integración crítica para cuentas pequeñas
- **Calculadora adaptativa**: Se debe adaptar al capital de cada usuario
- **Backtester primero**: Sin validación histórica fiable, no hay producto vendible
