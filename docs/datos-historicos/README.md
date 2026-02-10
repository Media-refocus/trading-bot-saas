# Datos Históricos del Canal - Instrucciones

Esta carpeta debe contener el export histórico del canal de Telegram de Xisco.

## Qué hay que subir

### 1. Export Crudo de Telegram
- **Nombre**: `telegram_export.json` (o el formato que tenga)
- **Qué contiene**: Todos los mensajes del canal con timestamps
- **Cómo se obtuvo**: Export manual o via Telethon

### 2. CSV de Señales Procesadas
- **Nombre**: `signals_raw.csv`
- **Formato actual**: `ts_utc;kind;side;price_hint`
- **Qué contiene**: Puntos de entrada y cierre identificados

### 3. Script de Procesamiento (si existe)
- **Nombre**: `process_signals.py` (o similar)
- **Qué hace**: Identifica puntos de entrada/cierre en el rango

## Ejemplo de estructura esperada

```
datos-historicos/
├── telegram_export.json          # Export crudo del canal
├── signals_raw.csv               # CSV con señales (formato actual)
├── process_signals.py            # Script procesador (si existe)
└── README.md                     # Este archivo
```

## Una vez subidos

1. **Avísame** para que lance el agente Explore
2. **Analizaré** el formato de las señales
3. **Diseñaré** el normalizador para backtesting fiable

---

## Notas sobre el problema actual

Según el resumen de ChatGPT:

> "El CSV no distingue bien:
> - Apertura real vs modificación
> - Cierre explícito vs implícito
> - Cambios de bias sin cierre formal"

**El objetivo es crear un normalizador que:**
1. Clasifique cada señal correctamente (ENTRY/MODIFICATION/CLOSE)
2. Detecte cambios de bias implícitos
3. Asigne contexto a cada señal
4. Genere un CSV limpio para el backtester
