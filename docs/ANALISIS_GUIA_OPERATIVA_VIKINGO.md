# Análisis Guía Operativa Vikingo Trading

> Fuente: Guía Operativa Canal de Señales Vikingo Trading
> Fecha: 2026-02-10
> Propósito: Adaptar el backtester EA a la operativa real de Xisco

---

## 1. Filosofía de Trading

### Principios Fundamentales
- **El problema NO es perder**, es no saber GESTIONAR lo que se pierde
- El mercado castiga al que no sabe salir o al que sobreopera
- Esta guía es ORIENTACIÓN, no una estrategia cerrada ni promesa de resultados
- La gestión de riesgo es más importante que la entrada

### Control de Emociones
- Muchos operan desde la emoción: entran tarde, promedian sin sentido, operan en noticias
- Terminan quemando no la cuenta, sino su cabeza

---

## 2. Guías por Nivel de Capital

| Guía | Capital | Lote Base | Distancia Promedios | SL Mental |
|------|---------|-----------|---------------------|-----------|
| **Guía 1** | < $250 | 0.01 | 40 pips | 250 pips |
| **Guía 2** | $250-$500 | 0.01 | 30 pips | 250 pips |
| **Guía 3** | $500-$1,000 | 0.01 | 30 pips | 300 pips |
| **Guía 4** | $1,000-$1,500 | 0.01 (o 0.02*) | 20 pips | 300 pips |
| **Guía 5** | > $1,500 | 0.01 (0.02*) | 20 pips | 300 pips |

*0.02 lote solo en momentos puntuales si margen sano (>6000-8000%)

---

## 3. Sistema de Promedios

### Cuándo Usar Promedios
✅ **SOLO cuando el precio va EN CONTRA**
❌ NO es para aguantar
❌ NO es para operar desde la emoción

### Cómo Promediar
1. **Dirección**: Misma dirección que la primera operación
2. **Tamaño**: Mismo tamaño (salvo puntos de reversión donde se puede variar)
3. **Objetivo**: Acercar el punto de Break Even (BE)
4. **Resultado**: Permite salir antes o tener beneficios al cerrar promedios

### Estrategia de Promedios
- Los promedios se pueden alargar hasta punto de entrada (depende de cada trader)
- Al cerrar promedios en ganancia, se reducen pérdidas o se obtienen beneficios

---

## 4. Gestión Cuando el Precio va a FAVOR

### Señal Válida
A partir de **+20 pips** de beneficio

### Opción 1: Cierre Parcial
- Cerrar en **+20 pips**
- Cerrar en **+30 pips**
- Cerrar en **+40 pips**

### Opción 2: Dejar Correr
- Mover SL a punto de entrada (BE)
- Dejar la operación correr

### Estrategia Avanzada (solo si margen lo permite)
⚠️ **NO usar si el nivel de margen no lo permite**

1. Abrir **2 operaciones** desde el inicio
2. Cerrar **UNA** a +20 pips
3. Mover SL a BE con la otra
4. Dejarla correr

---

## 5. Tabla de Lotaje y Riesgo

| Lote | Ganancia/Pérdida por 100 pips |
|------|------------------------------|
| 1.00 lote | $1,000 |
| 0.50 lote | $500 |
| 0.10 lote | $100 |
| 0.01 lote | $10 |

### Conversión Cuenta Cent a Dollar
- 1.00 lote CENT = 0.01 lote DOLLAR
- 2.00 lotes CENT = 0.02 lote DOLLAR

---

## 6. Parámetros para el Backtester

### Configuraciones a Testear

#### Estrategia 1: Guía 2 ($250-$500)
```
Lote Base: 0.01
Distancia Promedios: 30 pips
Máximos Promedios: 4 niveles (1 base + 3)
SL Mental: 250 pips
TP Objetivo: +20 pips (cierre total)
```

#### Estrategia 2: Guía 4 ($1,000-$1,500)
```
Lote Base: 0.01
Distancia Promedios: 20 pips
Máximos Promedios: 4 niveles (1 base + 3)
SL Mental: 300 pips
TP Objetivo: +20 pips (cierre parcial) + BE
```

#### Estrategia 3: Avanzada (2 operaciones)
```
Lote Base: 0.01 (2 operaciones desde inicio)
Distancia Promedios: 20 pips
Máximos Promedios: 4 niveles por operación
SL Mental: 300 pips
TP Objetivo: +20 pips (cerrar 1 operación) + BE (otra)
```

#### Estrategia 4: Grid Dinámico (Toni)
```
Lote Base: 0.03
Grid Schedule: "100:10,160:15,240:20,400:40,inf:50"
Máximos Promedios: 40 niveles
SL Trailing: Activa en +30, mueve cada +10
S00 Scalper: Cierra en +20 pips
```

---

## 7. Diferencias con EA Actual (Toni)

| Aspecto | Toni (actual) | Xisco (necesario) |
|---------|---------------|-------------------|
| **Promedios** | 40 niveles máx | 4 niveles máx (1 base + 3) |
| **Distancia** | Variable schedule | Fija (20, 30 o 40 pips según guía) |
| **SL** | Trailing genérico | Mental fijo (250-300 pips) |
| **TP** | S00 +20 pips | +20 pips o mover a BE |
| **Restricciones** | No detecta | RIESGO, SIN PROMEDIOS, SOLO 1 PROMEDIO |
| **Lotes** | 0.03 base | 0.01 base (escalable según capital) |
| **Estrategia** | Grid agresivo | Conservador con gestión mental |

---

## 8. Detección de Restricciones en Señales

### Restricciones conocidas del canal:
- **"RIESGO"** → Reducir a 1 promedio máximo
- **"SIN PROMEDIOS"** → 0 promedios (solo posición base)
- **"SOLO 1 PROMEDIO"** → Máximo 1 promedio (2 niveles total)

### Implementación necesaria en EA:
```mql5
// Detectar restricciones en campo "confidence" o nuevo campo "restrictions"
if (StringFind(message, "RIESGO") >= 0) maxLevels = 2;
else if (StringFind(message, "SIN PROMEDIOS") >= 0) maxLevels = 1;
else if (StringFind(message, "SOLO 1 PROMEDIO") >= 0) maxLevels = 2;
else maxLevels = 4; // Por defecto
```

---

## 9. Recomendaciones para Backtester

### 1. Crear Múltiples Configuraciones
- **Backtester_Xisco_G2.mq5** → Guía 2 (0.01, 30 pips, SL 250)
- **Backtester_Xisco_G4.mq5** → Guía 4 (0.01, 20 pips, SL 300)
- **Backtester_Xisco_Avanzado.mq5** → 2 operaciones, cierre parcial + BE
- **Backtester_Xisco_Restrictions.mq5** → Con detección de restricciones

### 2. Métricas Clave a Analizar
- **Win Rate**: % de rangos que cierran en verde
- **MFE (Maximum Favorable Excursion)**: Máximo pips a favor
- **MAE (Maximum Adverse Excursion)**: Máximo pips en contra
- **Avg Drawdown**: Drawdown promedio por rango
- **Max Levels Used**: Máximo nivel de promedio alcanzado
- **PnL per Range**: Beneficio/pérdida promedio por rango

### 3. Filtros de Validación
- ✅ Solo rangos mismo día (ya implementado)
- ✅ Rangos con cierre explícito
- ❌ Rangos que cruzan de día
- ❌ Rangos sin cierre (abiertos al final del CSV)

---

## 10. Próximos Pasos

1. ✅ Analizar guía operativa
2. **PENDIENTE**: Adaptar EA Backtester_Xisco_CLEAN.mq5 con:
   - 4 niveles máximos
   - Distancia fija de promedios (20/30/40 pips según parámetro)
   - SL mental (250/300 pips)
   - Opción de cierre en +20 pips
   - Opción de mover SL a BE en +20 pips
3. **PENDIENTE**: Añadir detección de restricciones
4. **PENDIENTE**: Crear variantes de estrategia
5. **PENDIENTE**: Ejecutar backtesting en MT5
6. **PENDIENTE**: Analizar results.csv

---

*Documento generado para adaptar el backtester a la operativa real de Vikingo Trading*
