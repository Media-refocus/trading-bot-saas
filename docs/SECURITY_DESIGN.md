# Sistema de Seguridad - Trading Bot SaaS

> **Version:** 1.0
> **Fecha:** 2026-02-25
> **Estado:** IMPLEMENTACION

---

## 1. API Keys - Ciclo de Vida

### 1.1 Generacion
- API key format: `tb_live_<32 chars hex>` o `tb_test_<32 chars hex>`
- Se genera hasheada en BD (SHA-256)
- **Solo se muestra UNA vez** al usuario al generarla
- Nunca se almacena en texto plano

### 1.2 Estados de API Key
| Estado | Descripcion | Bot puede operar? |
|--------|-------------|-------------------|
| `ACTIVE` | Suscripcion activa | SI |
| `PAUSED` | Suscripcion pausada (pago pendiente) | NO - gracia 3 dias |
| `REVOKED` | Suscripcion cancelada | NO |
| `EXPIRED` | Suscripcion vencida | NO |

### 1.3 Rotacion Automatica
- **Trigger:** Renovacion de suscripcion mensual
- **Accion:** Generar nueva API key, revocar anterior
- **Notificacion:** Email al usuario con nueva key
- **Gracia:** 24 horas para actualizar el bot con nueva key

### 1.4 Edge Cases
| Caso | Solucion |
|------|----------|
| Usuario cancela y vuelve a suscribirse | Generar NUEVA API key (no reusar) |
| Pago falla 3 veces | Revocar API key, pausar bot |
| Usuario solicita rotacion manual | Permitir desde dashboard (limite 1/mes) |
| API key comprometida | Revocacion inmediata via dashboard |

---

## 2. Validacion de Suscripcion

### 2.1 Check en Cada Request
```typescript
interface ValidationResult {
  valid: boolean;
  reason?: 'SUBSCRIPTION_INACTIVE' | 'API_KEY_REVOKED' | 'PLAN_LIMIT_EXCEEDED';
  tenant?: Tenant;
  plan?: Plan;
}
```

### 2.2 Flujo de Validacion
```
1. Recibir request con API key en header
2. Hash API key (SHA-256)
3. Buscar BotConfig por apiKey hash
4. Verificar estado de API key (ACTIVE)
5. Buscar Subscription del tenant
6. Verificar subscription.status === 'ACTIVE'
7. Verificar subscription.currentPeriodEnd > now()
8. Si todo OK: permitir request
9. Si falla: 401/403 con codigo de error especifico
```

### 2.3 Periodo de Gracia
- **3 dias** despues de vencer suscripcion: bot sigue funcionando
- Despues de 3 dias: API key pasa a `PAUSED`
- Despues de 7 dias: API key pasa a `REVOKED`

---

## 3. Rate Limiting

### 3.1 Limites por Endpoint
| Endpoint | Limite | Window |
|----------|--------|--------|
| `/api/bot/signals` | 30/min | 1 min |
| `/api/bot/heartbeat` | 120/hora | 1 hora |
| `/api/bot/config` | 60/hora | 1 hora |
| `/api/bot/auth` | 10/min | 1 min |
| Otros | 1000/hora | 1 hora |

### 3.2 Implementacion
- Usar `rate-limiter-flexible` con Redis (produccion) o memoria (desarrollo)
- Headers de respuesta: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### 3.3 Deteccion de Abuso
| Patron | Accion |
|--------|--------|
| >10x limite en 1 hora | Log warning, throttlear 5 min |
| >50x limite en 1 hora | Revocar API key, notificar usuario |
| Requests desde IPs sospechosas | Bloquear IP, requerir re-autenticacion |

---

## 4. Logs de Auditoria

### 4.1 Eventos a Loguear
| Evento | Datos | Retencion |
|--------|-------|-----------|
| API key generada | tenantId, timestamp | 90 dias |
| API key revocada | tenantId, reason, timestamp | 90 dias |
| Request autenticado | tenantId, endpoint, IP | 30 dias |
| Request rechazado | tenantId, reason, IP | 90 dias |
| Suscripcion cambiada | tenantId, oldStatus, newStatus | 90 dias |
| Rate limit exceeded | tenantId, endpoint, count | 30 dias |

### 4.2 Formato de Log
```json
{
  "timestamp": "2026-02-25T10:30:00Z",
  "event": "API_KEY_GENERATED",
  "tenantId": "xxx",
  "metadata": {
    "ip": "1.2.3.4",
    "userAgent": "trading-bot/1.0"
  }
}
```

---

## 5. Proteccion del Bot

### 5.1 Validacion al Iniciar
```python
# El bot al iniciar:
1. Validar API key contra SaaS
2. Obtener configuracion
3. Si API key invalida: NO iniciar, mostrar error
4. Si suscripcion inactiva: NO iniciar, mostrar mensaje
```

### 5.2 Validacion Periodica
```python
# Cada heartbeat (30 segundos):
1. Enviar heartbeat
2. Si respuesta 401/403:
   - Log error
   - Detener operativa (no abrir nuevas posiciones)
   - Cerrar posiciones existentes gradualmente (opcional)
   - Reintentar cada 5 min
```

### 5.3 Comportamiento en Fallo
| Tipo de Fallo | Accion del Bot |
|---------------|-----------------|
| API key revocada | Detener inmediatamente |
| Suscripcion vencida | Detener despues de cerrar posiciones abiertas |
| SaaS no responde | Continuar con ultima config conocida (modo offline) |
| Rate limit | Backoff exponencial, reintentar |

---

## 6. Prevencion de Ataques

### 6.1 Brute Force API Keys
- Rate limiting estricto en `/api/bot/auth`
- Bloquear IP despues de 10 intentos fallidos
- Notificar al equipo de intentos sospechosos

### 6.2 Replay Attacks
- Timestamp en requests (max 5 min de antiguedad)
- Nonce unico por request
- Signature HMAC para requests criticos

### 6.3 Man-in-the-Middle
- **OBLIGATORIO HTTPS en produccion**
- Certificate pinning en el bot (opcional)

### 6.4 Data Exfiltration
- API keys NUNCA en logs
- Credenciales MT5 NUNCA en BD del SaaS
- Credenciales MT5 solo en el VPS del cliente

---

## 7. Modelo de Datos Actualizado

### 7.1 Schema Changes
```prisma
model BotConfig {
  // ... existing fields ...

  // API Key Management
  apiKey          String   @unique    // SHA-256 hash
  apiKeyPlain     String?             // Solo al generar, luego null
  apiKeyStatus    String   @default("ACTIVE") // ACTIVE, PAUSED, REVOKED, EXPIRED
  apiKeyCreatedAt DateTime @default(now())
  apiKeyExpiresAt DateTime?             // Para rotacion programada

  // Rate Limiting
  rateLimitResetAt DateTime?
  requestCount     Int      @default(0)
}

model ApiKeyAudit {
  id          String   @id @default(cuid())
  tenantId    String
  event       String              // API_KEY_GENERATED, API_KEY_REVOKED, etc.
  metadata    Json?
  ipAddress   String?
  createdAt   DateTime @default(now())

  @@index([tenantId, createdAt])
}
```

---

## 8. Endpoints Seguros

### 8.1 Nuevos Endpoints
| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/bot/apikey` | GET | Estado de API key actual |
| `/api/bot/apikey` | POST | Generar nueva API key |
| `/api/bot/apikey` | DELETE | Revocar API key |
| `/api/bot/apikey/rotate` | POST | Rotacion manual |

### 8.2 Response Codes
| Codigo | Significado | Accion Cliente |
|--------|--------------|-----------------|
| 200 | OK | Continuar |
| 401 | API key invalida | Regenerar key / Re-autenticar |
| 403 | Suscripcion inactiva | Notificar usuario / Detener bot |
| 429 | Rate limit exceeded | Backoff y reintentar |

---

## 9. Implementacion Priorizada

### Fase 1: Core Security (HOY)
1. [x] Schema con apiKeyStatus y auditoria
2. [x] Validacion de API key + suscripcion en cada request
3. [x] Sistema de rate limiting basico
4. [x] Logs de auditoria

### Fase 2: Hardening (SIGUIENTE)
1. [ ] Rate limiting con Redis
2. [ ] Deteccion de abuso avanzada
3. [ ] IP blocking automatico
4. [ ] Alertas de seguridad

### Fase 3: Compliance (POST-MVP)
1. [ ] Audit logs exportables
2. [ ] GDPR compliance (si aplica)
3. [ ] Penetration testing
4. [ ] Security certification

---

## 10. Checklist de Seguridad Pre-Launch

- [ ] Todas las API keys hasheadas con SHA-256
- [ ] Validacion de suscripcion en TODOS los endpoints del bot
- [ ] Rate limiting activo en endpoints sensibles
- [ ] Logs de auditoria funcionando
- [ ] Bot rechaza operar con API key invalida
- [ ] Bot se detiene con suscripcion vencida
- [ ] HTTPS obligatorio en produccion
- [ ] Variables de entorno seguras
- [ ] No credenciales en codigo
- [ ] Backups de BD configurados
