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
  "tenantId": "clxxxxx",
  "symbol": "XAUUSD",
  "magicNumber": 20250101,

  "entryLot": 0.1,
  "entryNumOrders": 1,

  "gridStepPips": 10,
  "gridLot": 0.1,
  "gridMaxLevels": 4,
  "gridNumOrders": 1,
  "gridTolerancePips": 1,

  "takeProfitPips": 20,
  "stopLossPips": null,
  "useStopLoss": false,
  "useTrailingSL": true,
  "trailingSLPercent": 50,

  "restrictionType": null,
  "maxLevels": 4,

  "dailyLossLimitPercent": 3.0,

  "active": true,
  "configVersion": 5
}
```

**Response 401:**
```json
{
  "error": "Invalid API key or inactive subscription"
}
```

---

### POST /api/bot/heartbeat

Enviar heartbeat con estado del bot.

**Request:**
```json
{
  "timestamp": "2026-02-27T10:30:00Z",
  "status": "ONLINE",
  "mt5_connected": true,
  "telegram_connected": true,
  "open_positions": 2,
  "balance": 10000.50,
  "equity": 10150.25,
  "margin": 500.00,
  "config_version": 5
}
```

**Response 200:**
```json
{
  "success": true
}
```

---

### GET /api/bot/status

Obtener estado del bot (incluye kill switch).

**Response 200:**
```json
{
  "kill_switch": false,
  "paused": false,
  "message": null
}
```

---

### GET /api/bot/signals/pending

Obtener senales pendientes de procesar.

**Response 200:**
```json
{
  "signals": [
    {
      "id": "sig_xxxxx",
      "type": "ENTRY",
      "side": "BUY",
      "price": 2000.50,
      "symbol": "XAUUSD",
      "restrictionType": null,
      "maxLevels": 4,
      "timestamp": "2026-02-27T10:25:00Z"
    }
  ]
}
```

---

### POST /api/bot/signals/:id/ack

Confirmar procesamiento de una senal.

**Request:**
```json
{
  "status": "EXECUTED",
  "error": null
}
```

**Status posibles:**
- `EXECUTED` - Senal ejecutada correctamente
- `FAILED` - Error al ejecutar
- `REJECTED` - Rechazada (ej: daily loss limit)

**Response 200:**
```json
{
  "success": true
}
```

---

### POST /api/bot/trades

Reportar un trade ejecutado.

**Request:**
```json
{
  "signalId": "sig_xxxxx",
  "mt5Ticket": 123456,
  "side": "BUY",
  "symbol": "XAUUSD",
  "openPrice": 2000.50,
  "lotSize": 0.1,
  "level": 0,
  "status": "OPEN"
}
```

**Response 200:**
```json
{
  "success": true,
  "tradeId": "trade_xxxxx"
}
```

---

### PUT /api/bot/trades/:mt5Ticket

Actualizar estado de un trade (cierre).

**Request:**
```json
{
  "status": "CLOSED",
  "closePrice": 2002.50,
  "closeReason": "TAKE_PROFIT",
  "profitPips": 20.0,
  "profitMoney": 200.00
}
```

**Close reasons:**
- `TAKE_PROFIT`
- `STOP_LOSS`
- `TRAILING_SL`
- `MANUAL`
- `KILL_SWITCH`
- `SIGNAL_CLOSE`

---

### GET /api/bot/can-update-config

Verificar si es seguro actualizar la configuracion.

**Response 200:**
```json
{
  "can_update": true,
  "reason": null
}
```

**Response 200 (con posiciones):**
```json
{
  "can_update": false,
  "reason": "There are 2 open positions"
}
```

---

## Implementacion en el SaaS

### Crear router tRPC

```typescript
// server/api/routers/bot.ts

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { verifyApiKey } from "~/lib/bot-auth";

export const botRouter = createTRPCRouter({
  config: publicProcedure
    .meta({ openapi: { method: "GET", path: "/bot/config" } })
    .input(z.void())
    .output(z.any())
    .query(async ({ ctx }) => {
      const tenant = await verifyApiKey(ctx.req);
      if (!tenant) throw new TRPCError({ code: "UNAUTHORIZED" });

      const config = await ctx.db.botConfig.findUnique({
        where: { tenantId: tenant.id }
      });

      return {
        tenantId: tenant.id,
        symbol: config?.symbol ?? "XAUUSD",
        // ... resto de campos
      };
    }),

  heartbeat: publicProcedure
    .meta({ openapi: { method: "POST", path: "/bot/heartbeat" } })
    .input(z.object({
      timestamp: z.string(),
      status: z.enum(["ONLINE", "OFFLINE", "PAUSED", "ERROR"]),
      mt5_connected: z.boolean(),
      telegram_connected: z.boolean(),
      open_positions: z.number(),
      balance: z.number(),
      equity: z.number(),
      margin: z.number(),
      config_version: z.number(),
    }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const tenant = await verifyApiKey(ctx.req);
      if (!tenant) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Guardar heartbeat
      await ctx.db.botHeartbeat.create({
        data: {
          botConfigId: tenant.botConfig?.id,
          timestamp: new Date(input.timestamp),
          mt5Connected: input.mt5_connected,
          telegramConnected: input.telegram_connected,
          openPositions: input.open_positions,
          // ...
        }
      });

      // Actualizar estado del bot
      await ctx.db.botConfig.update({
        where: { tenantId: tenant.id },
        data: { status: input.status }
      });

      return { success: true };
    }),

  // ... otros endpoints
});
```

### Autenticacion API Key

```typescript
// lib/bot-auth.ts

import { NextApiRequest } from "next";
import { prisma } from "~/server/db";
import { verify } from "bcrypt";

export async function verifyApiKey(req: NextApiRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const apiKey = authHeader.slice(7);
  if (!apiKey.startsWith("tb_")) {
    return null;
  }

  // Buscar tenant por API key hash
  const tenants = await prisma.tenant.findMany({
    include: { botConfigs: true }
  });

  for (const tenant of tenants) {
    const botConfig = tenant.botConfigs[0];
    if (botConfig && await verify(apiKey, botConfig.apiKeyHash)) {
      return tenant;
    }
  }

  return null;
}
```

---

## Generar API Key

```typescript
// app/(dashboard)/settings/page.tsx

async function generateApiKey() {
  // Generar API key aleatoria
  const apiKey = `tb_${randomBytes(32).toString('hex')}`;

  // Hashear para guardar
  const apiKeyHash = await hash(apiKey, 10);

  // Guardar en DB
  await api.botConfig.update.mutate({ apiKeyHash });

  // Mostrar al usuario UNA vez
  setGeneratedKey(apiKey);
}
```

**IMPORTANTE:** La API key solo se muestra una vez al generarla. El usuario debe guardarla.

---

## Seguridad

1. **API Keys hasheadas** - Nunca guardar en texto plano
2. **Rate limiting** - Max 60 requests/minuto por API key
3. **Kill switch** - El SaaS puede matar el bot remotamente
4. **Logs auditables** - Registrar todos los accesos

---

*Ultima actualizacion: 2026-02-27*
