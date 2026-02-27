# Guia de Operativas - Trading Bot SaaS

## Como funciona el sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        FLUJO DE OPERATIVAS                       │
└─────────────────────────────────────────────────────────────────┘

1. CONFIGURAS EN EL DASHBOARD
   ┌─────────────────────────┐
   │  Dashboard Web          │
   │  - Lote base            │
   │  - Niveles maximos      │
   │  - Take Profit          │
   │  - Daily Loss Limit     │
   │  - Etc...               │
   └───────────┬─────────────┘
               │
               ▼ Guardar
   ┌─────────────────────────┐
   │  SaaS (servidor)        │
   │  Guarda configuracion   │
   └───────────┬─────────────┘
               │
               ▼ Cada 5 minutos
   ┌─────────────────────────┐
   │  Bot en tu VPS          │
   │  Lee nueva configuracion│
   │  La aplica              │
   └─────────────────────────┘
```

---

## Regla de Oro: NO cambiar con posiciones abiertas

### Por que?

Si cambias la configuracion mientras hay posiciones abiertas:
- El Take Profit puede no coincidir con las posiciones existentes
- Los niveles de promedio pueden ser inconsistentes
- El Daily Loss Limit se puede calcular mal

### Como funciona la proteccion

El bot **NO actualizara** la configuracion si:
- Hay posiciones abiertas en MT5
- Hay operaciones pendientes

**El bot espera a que todas las posiciones se cierren** antes de aplicar la nueva configuracion.

### Que veras en el dashboard

```
Estado de configuracion:
✅ "Configuracion aplicada" - Todo actualizado
⚠️ "Pendiente: hay X posiciones abiertas" - Se aplicara cuando cierren
```

---

## Parametros de operativa

### Parametros de ENTRADA

| Parametro | Que hace | Valor tipico |
|-----------|----------|--------------|
| **Lote base** | Tamano de la primera orden | 0.01 - 0.10 |
| **Ordenes por entrada** | Cuantas ordenes abre en cada senal | 1 |

### Parametros de GRID (Promedios)

| Parametro | Que hace | Valor tipico |
|-----------|----------|--------------|
| **Distancia entre niveles** | Pips entre cada promedio | 10 - 20 |
| **Lote de promedio** | Tamano de ordenes de promedio | 0.01 - 0.10 |
| **Niveles maximos** | Cuantos promedios hacer maximo | 2 - 4 |
| **Tolerancia** | Pips de margen para detectar nivel | 1 |

### Parametros de SALIDA

| Parametro | Que hace | Valor tipico |
|-----------|----------|--------------|
| **Take Profit** | Pips para cerrar con beneficio | 15 - 30 |
| **Stop Loss** | Pips para cortar perdidas | 0 (desactivado) |
| **Usar Stop Loss** | Activar/desactivar SL | Desactivado |
| **Trailing SL** | SL que sigue el precio | Activado |

### Protecciones

| Parametro | Que hace | Valor tipico |
|-----------|----------|--------------|
| **Daily Loss Limit** | % maximo de perdida diaria | 3% - 5% |

### Restricciones del canal

| Tipo | Que hace |
|------|----------|
| **Sin restriccion** | Aplica todos los promedios |
| **RIESGO** | Modo conservador |
| **SIN_PROMEDIOS** | No hace promedios, solo entrada |
| **SOLO_1_PROMEDIO** | Maximo 1 promedio |

---

## Ejemplo de operativa completa

### Escenario

- Lote base: 0.05
- Distancia niveles: 10 pips
- Niveles maximos: 3
- Take Profit: 20 pips
- Trailing SL: 50%

### Secuencia de una operacion

```
1. SENAL: BUY XAUUSD @ 2000.00

   El bot abre:
   - BUY 0.05 @ 2000.00
   - TP: 2002.00 (20 pips)
   - SL: Trailing (se activa)

2. PRECIO BAJA a 1999.00 (10 pips abajo)

   El bot abre promedio:
   - BUY 0.05 @ 1999.00 (Nivel 1)

3. PRECIO BAJA a 1998.00 (20 pips abajo)

   El bot abre promedio:
   - BUY 0.05 @ 1998.00 (Nivel 2)

   Precio medio: 1999.00
   Nuevo TP calculado: 2000.00 (para cubrir todo)

4. PRECIO SUBE a 2000.00

   TAKE PROFIT ALCANZADO

   El bot cierra todas las posiciones
   Resultado: +20 pips en posicion 1, +10 pips en posicion 2, 0 en posicion 3
   = +30 pips total
```

---

## Cuando CAMBIAR la operativa

### Es SEGURO cambiar cuando:

✅ No hay posiciones abiertas
✅ El bot esta en estado "OFFLINE" o "PAUSED"
✅ Has cerrado manualmente todas las posiciones

### Es PELIGROSO cambiar cuando:

⚠️ Hay posiciones abiertas
⚠️ Hay operaciones pendientes
⚠️ El mercado esta muy volatil (news)

---

## Daily Loss Limit

### Como funciona

1. Al inicio del dia (00:00 UTC), se guarda tu balance
2. Si pierdes mas del % configurado, el bot se PAUSA
3. Tienes que reactivarlo manualmente desde el dashboard

### Ejemplo

```
Balance inicio: 10,000 EUR
Daily Loss Limit: 3%

Si pierdes 300 EUR (3%)...
→ El bot se PAUSA automaticamente
→ Recibes notificacion Telegram
→ Tienes que reactivar manualmente
```

### Por que pausar automaticamente?

- Evita "revenge trading"
- Te obliga a revisar que esta fallando
- Protege tu capital de rachas malas

---

## Kill Switch

### Que es

Boton de emergencia que cierra **TODAS** las posiciones inmediatamente.

### Cuando usarlo

- Ves que el mercado esta en contra y no para
- Hay noticias importantes no esperadas
- Quieres parar todo YA

### Como funciona

1. Click en "KILL SWITCH" en el dashboard
2. El bot recibe la orden en menos de 5 segundos
3. Cierra TODAS las posiciones del simbolo configurado
4. El bot pasa a estado PAUSED

---

## Preguntas Frecuentes

### ¿Puedo cambiar el lote si tengo posiciones abiertas?

**NO.** El bot ignorara el cambio hasta que cierres todas las posiciones.

### ¿Que pasa si cambio el TP con posiciones abiertas?

El nuevo TP **no se aplicara** a las posiciones existentes, solo a las nuevas.

### ¿Puedo operar manualmente en MT5 mientras el bot esta activo?

Si, pero **no recomendado**. Si abres posiciones manualmente, el bot puede confundirse.

### ¿Que pasa si pierdo conexion a internet?

El bot sigue funcionando en el VPS. Cuando vuelvas a tener conexion, veras el estado actualizado.

### ¿Que pasa si MT5 se cierra?

El bot detectara que MT5 no esta y:
1. Intentara reconectar cada 30 segundos
2. Te notificara por Telegram (si lo tienes configurado)
3. No abrira nuevas posiciones hasta reconectar

### ¿Puedo usar el bot en multiples cuentas?

Depende de tu plan:
- **Trader (57 EUR)**: 1 cuenta MT5
- **Pro (97 EUR)**: 3 cuentas MT5
- **VIP (197 EUR)**: Cuentas ilimitadas

Cada cuenta necesita su propio VPS o instancia del bot.

---

## Troubleshooting

### "El bot no aplica mi nueva configuracion"

**Causa:** Hay posiciones abiertas

**Solucion:**
1. Espera a que las posiciones se cierren
2. O cierralas manualmente en MT5

### "El bot dice Daily Loss Limit alcanzado pero quiero seguir"

**Solucion:**
1. Ve al dashboard
2. Click en "Reactivar bot"
3. Considera si es buena idea o estas en "revenge trading"

### "Cambie el Take Profit pero las posiciones siguen con el antiguo"

**Causa:** El TP de las posiciones ya abiertas no se modifica

**Solucion:**
1. Cierra las posiciones manualmente
2. O espera a que lleguen al TP original
3. Las nuevas posiciones usaran el nuevo TP

---

## Checklist antes de cambiar operativa

- [ ] He verificado que NO hay posiciones abiertas
- [ ] He verificado que NO hay ordenes pendientes
- [ ] El mercado esta en condiciones normales (sin news inminentes)
- [ ] He guardado la nueva configuracion
- [ ] He verificado que el bot muestra "Configuracion aplicada"

---

*Ultima actualizacion: 2026-02-27*
