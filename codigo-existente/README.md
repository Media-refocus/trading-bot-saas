# Código Existente del Bot - Instrucciones

Esta carpeta debe contener los scripts Python del bot que estabas usando con Xisco.

## Qué hay que subir

Sube **el último script que utilizaste antes de dejar de operar**.

### Scripts esperados (si los tienes separados):

1. **Script principal** (`bot_xisco.py` o `main.py`)
   - Punto de entrada del bot
   - Coordina todos los componentes

2. **Listener de Telegram** (`telegram_listener.py` o similar)
   - Usa Telethon
   - Escucha el canal 24/7
   - Detecta mensajes de entrada, SL, cierres

3. **Parser de Señales** (`signal_parser.py` o similar)
   - Parsea los mensajes según semántica
   - Detecta intención: BUY, SELL, SL, TP, cierre
   - Identifica restricciones: RIESGO, SIN PROMEDIOS, etc.

4. **Motor de Decisión** (`decision_engine.py` o similar)
   - Gestiona sistema de promedios (grid)
   - Calcula niveles de entrada: L00, L10, L20, L30
   - Gestión SL dinámica: BE+20, BE+50
   - Decide cuándo abrir promedios

5. **Ejecutor MT5** (`mt5_executor.py` o similar)
   - Conecta con MetaTrader 5 vía API
   - Ejecuta órdenes market/limit
   - Modifica SL/TP de posiciones
   - Cierra posiciones (total o parcial)

6. **State Manager** (`state_manager.py` o similar)
   - Guarda estado persistente de la operación
   - Controla promedios abiertos
   - Mantiene restricciones activas

### Si todo está en un solo archivo:

No hay problema, súbelo con cualquier nombre y yo analizaré la estructura.

---

## Ejemplo de estructura esperada

```
codigo-existente/
├── bot_xisco.py                 # Script principal (o el último que usaste)
├── telegram_listener.py         # [Opcional] Listener de Telegram
├── signal_parser.py             # [Opcional] Parser de señales
├── mt5_executor.py              # [Opcional] Ejecutor MT5
├── state_manager.py             # [Opcional] Gestión de estado
├── config.yaml                  # [Opcional] Configuración
├── requirements.txt             # [Opcional] Dependencias Python
└── README.md                    # Este archivo
```

---

## Una vez subido el código

1. **Lanzaré el agente Explore** para analizar:
   - Estructura de los scripts
   - Librerías usadas (Telethon, MetaTrader5, etc.)
   - Cómo se conecta a MT5
   - Cómo gestiona el estado
   - Edge cases que se han considerado

2. **Lanzaré el agente Plan** para diseñar:
   - Arquitectura del nuevo sistema multi-tenant
   - Cómo adaptar para MT4 + MT5
   - Estrategia para el backtester

3. **Actualizaremos el PRD** con los detalles técnicos reales

---

## Notas del resumen de ChatGPT

### Lo que está bien implementado:
- ✅ Listener Telegram (Telethon, sesión persistente)
- ✅ Parser semántico (detecta entradas, SL, riesgos, cierres)
- ✅ Sistema de promedios (grid dinámico)
- ✅ Gestión SL avanzada (BE+20, BE+50)
- ✅ Ejecutor MT5

### Lo que está a medias:
- ⚠️ Gestión de estado persistente (frágil con Ctrl+C)
- ⚠️ Cierres automáticos de promedios
- ❌ Soporte MT4

### Lo que falta:
- ❌ Normalizador de señales históricas
- ❌ Backtester completo
- ❌ Web dashboard
