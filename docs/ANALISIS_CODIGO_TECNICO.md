# ANÁLISIS TÉCNICO DEL BOT DE TRADING - CÓDIGO EXISTENTE

> **Agente**: Explore (a2787bc)
> **Fecha**: 2025-02-10
> **Tiempo análisis**: ~4 minutos
> **Archivos analizados**:
> - `codigo-existente/señales_toni_v3_MONOCUENTA.py` (430 líneas)
> - `codigo-existente/copiador_GUILLE.yml` (configuración)

---

## 1. ARQUITECTURA GENERAL DEL SISTEMA

### 1.1 Diagrama de Arquitectura
```
Telegram Channels
       ↓ (Señales)
Telegram Client (Telethon)
       ↓
Multi-Account Bot Handler
       ↓
┌───────────────────────────────────────────────────────┐
│ AccountBot (XAUUSD - GRID INFINITO)                   │
│ - Estado Persistente (JSON)                            │
│ - Sistema Grid                                        │
│ - Trailing SL Virtual                                 │
│ - Gestión de Órdenes MT5                              │
└───────────────────────────────────────────────────────┘
       ↓
MetaTrader 5 (API)
       ↓
Positions / Orders
```

### 1.2 Componentes Principales
- **Telegram Client**: Escucha señales de canales específicos
- **AccountBot**: Gestiona una cuenta MT5 con sistema grid infinito
- **State Manager**: Persistencia de estado en JSON
- **Grid Manager**: Sistema de promedios escalonados
- **Trailing SL**: Stop Loss virtual dinámico

## 2. ANÁLISIS TÉCNICO DETALLADO

### 2.1 Grid System - ¿Cómo Funciona Exactamente?

#### Geometría de la Grilla
```python
# Parámetros base
DIST_PIP = 0.10  # 1 pip ≈ 0.10 USD (XAU/USD)
GRID_DIST = step_pips * DIST_PIP  # Ej: 10 pips = 1.0 USD
HALF_GRID = GRID_DIST / 2  # 0.5 USD

# Cálculo de niveles
lvl = int((abs(pos.price_open - p0) + HALF_GRID) // GRID_DIST)
```

#### Flujo del Grid
1. **Entrada**: Señal BUY/SELL abre posición Nivel 0
2. **Expansión**: El precio se mueve, se abren nuevos niveles
3. **Cierre**: Cada nivel se cierra al alcanzar +1 GRID de profit
4. **Reinicio**: Al detectar "cerramos rango", se cierra TODO

#### Características Clave
- **Grid Infinito**: Sin límite de niveles, solo `max` niveles simultáneos
- **Sin Duplicados**: Los niveles se basan en coordenadas, no en conteo
- **Auto-Rebalanceo**: Se adapta a la volatilidad del mercado

### 2.2 Estado Persistente - Gestión JSON

#### Estructura del Estado
```json
{
  "side": "BUY",
  "entry": 2650.00,
  "entry_open": true,
  "entry_sl": 2640.00,
  "pending_levels": [1, 2, 3]
}
```

### 2.3 Conexión a MT5 - Librerías y Gestión

#### Librerías Utilizadas
```python
import MetaTrader5 as mt
from telethon import TelegramClient, events
from telethon.tl.types import InputChannel
import yaml
```

#### Gestión de Conexiones
```python
def _mt5(self) -> bool:
    if self._mt5_ready and mt.terminal_info():
        return True
    ok = mt.initialize(login=self.login, password=self.password,
                       server=self.server, path=self.path)
    self._mt5_ready = bool(ok)
    return self._mt5_ready
```

### 2.4 Detección de Señales - Regex y Análisis

#### Patrones de Detección
```python
# Patrón principal
BASE_PATTERN = "|".join({re.sub(r"[^A-Z]+", "", b.SYMBOL.split("-")[0]) for b in BOTS})
SIG_RE = re.compile(rf"\b(BUY|SELL)\b\s+\d+(?:[.,]\d+)?\s+({BASE_PATTERN})(?:[-\w]*)", re.I)
CLOSE_RE = re.compile(r"cerramos[\W_]*rango", re.I | re.UNICODE)
```

## 3. ADAPTACIÓN NECESARIA PARA XISCO

### 3.1 Cambios Principales Toni → Xisco

| Aspecto | Toni (actual) | Xisco (necesario) |
|---------|---------------|-------------------|
| **Max promedios** | 40 niveles | 4 (1 base + 3) |
| **Restricciones** | No detecta | RIESGO, SIN PROMEDIOS, SOLO 1 |
| **SL dinámico** | Trailing genérico | +60→BE+20, +90→BE+50 |
| **Formato señales** | BUY/SELL + "cerramos rango" | BUY/SELL + TP1/2/3 + SL + mods |
| **Símbolo** | XAUUSD-STDc (VT Markets) | XAUUSD (varios brokers) |

### 3.2 Características a Añadir para Xisco

#### 1. Sistema de Restricciones
```python
# Detectar restricciones del canal
RIESGO_PATTERN = re.compile(r'\bRIESGO\b', re.I)
SIN_PROMEDIOS_PATTERN = re.compile(r'\bSIN\s+PROMEDIOS\b', re.I)
SOLO_1_PROMEDIO_PATTERN = re.compile(r'\bSOLO\s+1\s+PROMEDIO\b', re.I)

# Aplicar a configuración de promedios
if RIESGO_MATCH:
    max_promedios = 1
elif SIN_PROMEDIOS_MATCH:
    max_promedios = 0
elif SOLO_1_PROMEDIO_MATCH:
    max_promedios = 1
else:
    max_promedios = 3  # Default
```

#### 2. SL Dinámico por Niveles
```python
def check_sl_levels(current_price, entry_price, side):
    pips_profit = abs(current_price - entry_price) / DIST_PIP

    if side == "BUY":
        if pips_profit >= 90:
            return entry_price + 50 * DIST_PIP  # BE + 50
        elif pips_profit >= 60:
            return entry_price + 20 * DIST_PIP  # BE + 20
    else:  # SELL
        if pips_profit >= 90:
            return entry_price - 50 * DIST_PIP
        elif pips_profit >= 60:
            return entry_price - 20 * DIST_PIP

    return None  # No cambiar SL
```

#### 3. Cierres Parciales
```python
# Detectar tipos de cierre
CERRAMOS_TODO = re.compile(r'\bCERRAMOS\s+TODO\b', re.I)
CERRAMOS_PROMEDIO = re.compile(r'\bCERRAMOS\s+PROMEDIO\b', re.I)

def execute_close(close_type, positions):
    if close_type == "TODO":
        close_all_positions(positions)
    elif close_type == "PROMEDIO":
        close_average_positions(positions)
```

## 4. CONCLUSIONES

### Fortalezas del Código Toni
- ✅ Grid infinito sin duplicados bien implementado
- ✅ Estado persistente robusto
- ✅ Detección precisa de señales básicas
- ✅ Manejo básico de errores y reintentos

### Debilidades que hay que solucionar
- ❌ Single thread para operaciones críticas
- ❌ Sin gestión de riesgo avanzada
- ❌ Configuración inflexible
- ❌ No detecta restricciones del canal
- ❌ No tiene SL dinámico por niveles (+60, +90)

### Para Adaptarlo a Xisco
1. **Añadir detector de restricciones**: RIESGO, SIN PROMEDIOS, SOLO 1
2. **Implementar SL dinámico**: +60→BE+20, +90→BE+50
3. **Limitar promedios**: Max 4 niveles (1 base + 3)
4. **Añadir cierres parciales**: CERRAMOS TODO vs CERRAMOS PROMEDIO
5. **Mejorar parser**: Detectar TP1/2/3, SL, modificaciones

---

## 5. RECOMENDACIONES TÉCNICAS

### Para el Backtester
1. Reutilizar lógica de grid del código Toni
2. Añadir sistema de restricciones
3. Implementar SL dinámico por niveles
4. Parsear TP1/2/3 y SL desde las señales

### Para el EA MQL5/MQL4
1. Traducir lógica de grid Python → MQL5
2. Implementar calculadora de riesgo adaptativa
3. Añadir parámetros configurables para el cliente
4. Sistema de detección de señales vía API REST

### Para el Servidor Central
1. Reutilizar Telethon listener del código Toni
2. Añadir parser mejorado para formato Xisco
3. Implementar API REST para que los EAs consulten
4. Sistema de estado persistente mejorado
