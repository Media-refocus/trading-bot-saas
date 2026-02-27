# API del Bot - Especificacion

El bot Python necesita que el SaaS exponga los siguientes endpoints.

## Autenticacion

Todos los endpoints requieren header:
```
Authorization: Bearer tb_xxxxxxxxxxxxx
```

Donde `tb_xxx` es la API Key generada en el dashboard.

---

## Endpoints

### GET /api/bot/config

Obtener la configuracion actual del bot.

**Response 200:**
```json
{
  "success": true,
  "botId": "clxxxxx",
  "symbol": "XAUUSD",
  "magicNumber": 20250101,
  "entry": {
    "lot": 0.1,
    "numOrders": 1
  },
  "grid": {
    "stepPips": 10,
    "lot": 0.1,
    "maxLevels": 4,
    "numOrders": 1,
    "tolerancePips": 1
  },
  "restrictions": {
    "type": null,
    "maxLevels": 4
  },
  "accounts": [
    {
      "id": "acc_xxx",
      "login": "123456",
      "password": "password123",
      "server": "ICMarketsSC-Demo",
      "symbol": "XAUUSD",
      "magic": 20250101
    }
  ],
  "telegram": {
    "apiId": "12345",
    "apiHash": "xxxx",
    "channels": [{"id": "123", "accessHash": "456"}]
  },
  "heartbeatIntervalSeconds": 30,
  "configRefreshIntervalSeconds": 300
}
```

**Response 401:**
```json
{
  "error": "Invalid API key"
}
```

---

### POST /api/bot/heartbeat

Enviar heartbeat con estado del bot.

**Request:**
```json
{
  "timestamp": "2026-02-27T10:30:00Z",
  "mt5Connected": true,
  "telegramConnected": true,
  "openPositions": 2,
  "pendingOrders": 0,
  "accounts": [
    {
      "login": 123456,
      "server": "ICMarketsSC-Demo",
      "balance": 10000.50,
      "equity": 10150.25,
      "margin": 500.00,
      "openPositions": 2
    }
  ]
}
```

**Response 200:**
```json
{
  "success": true,
  "serverTime": "2026-02-27T10:30:01Z",
  "commands": []
}
```

**Comandos disponibles:**
- `{ "type": "PAUSE", "reason": "..." }`
- `{ "type": "RESUME" }`
- `{ "type": "CLOSE_ALL", "reason": "KILL_SWITCH" }`
- `{ "type": "UPDATE_CONFIG" }`

---

### GET /api/bot/status

Obtener estado del bot (incluye kill switch).

**Response 200:**
```json
{
  "success": true,
  "status": "ONLINE",
  "kill_switch": false,
  "paused": false,
  "can_update_config": true,
  "open_positions": 0,
  "message": null,
  "config_version": 1709035800000
}
```

---

### GET /api/bot/signals/pending

Obtener senales pendientes de procesar.

**Response 200:**
```json
{
  "success": true,
  "signals": [
    {
      "id": "sig_xxxxx",
      "type": "ENTRY",
      "side": "BUY",
      "price": 2000.50,
      "symbol": "XAUUSD",
      "restriction_type": null,
      "max_levels": 4,
      "channel_name": "Trading Signals",
      "timestamp": "2026-02-27T10:25:00Z"
    }
  ],
  "count": 1
}
```

---

### POST /api/bot/signals/[id]/ack

Confirmar procesamiento de una senal.

**Request:**
```json
{
  "status": "EXECUTED",
  "error": null,
  "mt5_ticket": 123456
}
```

**Status posibles:**
- `EXECUTED` - Senal ejecutada correctamente
- `FAILED` - Error al ejecutar
- `REJECTED` - Rechazada (ej: daily loss limit)
- `SKIPPED` - Ignorada por restriccion

**Response 200:**
```json
{
  "success": true,
  "signal_id": "sig_xxxxx",
  "status": "EXECUTED",
  "processed_at": "2026-02-27T10:25:05Z"
}
```

---

### POST /api/bot/trade

Reportar un trade (abrir, cerrar o actualizar).

**Abrir trade:**
```json
{
  "action": "OPEN",
  "signalId": "sig_xxxxx",
  "botAccountId": "acc_xxx",
  "mt5Ticket": 123456,
  "side": "BUY",
  "symbol": "XAUUSD",
  "level": 0,
  "openPrice": 2000.50,
  "lotSize": 0.1,
  "stopLoss": 0,
  "takeProfit": 2002.50,
  "openedAt": "2026-02-27T10:25:00Z"
}
```

**Cerrar trade:**
```json
{
  "action": "CLOSE",
  "botAccountId": "acc_xxx",
  "mt5Ticket": 123456,
  "closePrice": 2002.50,
  "closeReason": "TAKE_PROFIT",
  "profitPips": 20.0,
  "profitMoney": 200.00,
  "closedAt": "2026-02-27T11:00:00Z"
}
```

**Actualizar posicion:**
```json
{
  "action": "UPDATE",
  "botAccountId": "acc_xxx",
  "mt5Ticket": 123456,
  "currentPrice": 2001.50,
  "virtualSL": 2000.00,
  "unrealizedPL": 100.00,
  "unrealizedPips": 10.0
}
```

**Close reasons:**
- `TAKE_PROFIT`
- `STOP_LOSS`
- `MANUAL`
- `GRID_STEP`
- `VIRTUAL_SL`

---

### GET /api/bot/can-update-config

Verificar si es seguro actualizar la configuracion.

**Response 200:**
```json
{
  "success": true,
  "can_update": true,
  "open_positions": 0,
  "live_positions": 0,
  "reason": null
}
```

**Response 200 (con posiciones):**
```json
{
  "success": true,
  "can_update": false,
  "open_positions": 2,
  "live_positions": 2,
  "reason": "There are 2 open trades"
}
```

---

## Flujo de Comandos

### Kill Switch

1. Dashboard cambia status a `KILL_REQUESTED`
2. Bot recibe comando `CLOSE_ALL` en siguiente heartbeat
3. Bot cierra todas las posiciones
4. Status cambia a `PAUSED`

### Reanudar Bot

1. Dashboard cambia status de `PAUSED` a `RESUMING`
2. Bot recibe comando `RESUME` en siguiente heartbeat
3. Status cambia a `ONLINE`

---

## Rate Limiting

- Max 60 requests/minuto por IP
- Headers de respuesta:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

---

## Seguridad

1. **API Keys hasheadas** - Nunca guardar en texto plano
2. **Rate limiting** - Proteccion contra abuso
3. **Kill switch** - Control remoto de emergencia
4. **Logs auditables** - Registrar todos los accesos
5. **Cache de auth** - TTL 60 segundos para reducir carga DB

---

*Ultima actualizacion: 2026-02-27*
