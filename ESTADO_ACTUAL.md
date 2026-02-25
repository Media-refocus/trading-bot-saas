# Trading Bot SaaS - Estado Actual
**Última actualización:** 26 Feb 2026

---

## 📁 Repositorio
```
C:\Users\guill\Projects\trading-bot-saas-bot
Branch: feature/bot-operativa
```

---

## ✅ COMPLETADO

### 1. Sistema de Planes (EUR)
| Plan | Precio | Posiciones | Niveles | Fee Implementación |
|------|--------|------------|---------|-------------------|
| Starter | 57€/mes | 1 | 2 | +97€ |
| Trader | 97€/mes | 3 | 4 | Incluido |
| Pro | 197€/mes | 5 | 6 | Incluido |
| Enterprise | 497€/mes | 10 | 10 | Incluido |

**Archivos clave:**
- `prisma/schema.prisma` - Modelo Plan con 15+ campos
- `lib/plans.ts` - Funciones de verificación de límites + `validateMt4Access()`
- `app/(dashboard)/pricing/page.tsx` - UI de pricing
- `prisma/seed.ts` - 4 planes en EUR

### 2. Sistema de Onboarding
- Página `/onboarding` con 5 pasos
- APIs: `/api/onboarding/status`, `/api/onboarding/vps`, `/api/onboarding/mt5`
- Modelo `VpsAccess` en schema

### 3. Soporte MT4 (EA Receptor)
**Sin coste adicional, usuario instala EA**

| Archivo | Descripción |
|---------|-------------|
| `mt4-ea/BotOperativaReceiver.mq4` | EA completo (~400 líneas) |
| `mt4-ea/README.md` | Instrucciones de instalación |
| `app/(dashboard)/mt4-setup/page.tsx` | Página de configuración |
| `app/api/mt4/*.ts` | 5 APIs de comunicación |

**Flujo:** EA hace HTTP polling → SaaS valida suscripción → Devuelve señales

### 4. Validación de Suscripción Activa (NUEVO 26 Feb)
- Función `validateMt4Access()` en `lib/plans.ts`
- Valida: API Key + apiKeyStatus === "ACTIVE" + Subscription activa
- Código 402 (Payment Required) si suscripción inactiva
- Código 403 si API Key revocada
- Aplicado a todas las APIs MT4: health, signals, signals/confirm, status, positions

### 5. Soporte MT5 (API Oficial)
**Ya funcional via Python**
- Librería `MetaTrader5` Python
- Conexión directa sin instalación del usuario

---

## 🔄 PENDIENTE

### Prioridad Alta
| Tarea | Descripción | Esfuerzo |
|-------|-------------|----------|
| ~~planStatus en APIs MT4~~ | ✅ Completado | - |
| Compilar EA a .ex4 | El usuario necesita el archivo compilado | 5 min |
| Stripe Integration | Webhooks para pagos reales | 4-6h |

### Prioridad Media
| Tarea | Descripción |
|-------|-------------|
| Encriptación credenciales | VPS y MT5 en texto plano |
| Testing EA | Probar en cuenta demo MT4 |

### Prioridad Baja
| Tarea | Descripción |
|-------|-------------|
| Documentación usuario | PDF con instrucciones |
| PWA | Convertir a app instalable |

---

## 🏗️ Arquitectura de Protección MT4

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO DE VALIDACIÓN MT4                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  1. EA envía API Key          │
              └───────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  2. validateMt4Access()       │
              │  - Busca botConfig por apiKey │
              │  - Verifica apiKeyStatus      │
              │  - Verifica Subscription      │
              └───────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │ API Key     │    │ API Key     │    │ Sin suscrip-│
   │ inválida    │    │ revocada    │    │ ción activa │
   │ 401         │    │ 403         │    │ 402         │
   └─────────────┘    └─────────────┘    └─────────────┘
```

---

## 🚀 Comandos Rápidos
```bash
cd /c/Users/guill/Projects/trading-bot-saas-bot
npm run dev          # Arrancar dev server
npm run build        # Build producción
npx tsx scripts/check-plans.ts  # Ver planes en DB
git log --oneline -5  # Ver commits
```

---

## 💰 Contrato Xisco (Referencia)
- Precio base: 57€/mes
- Implementación: 97€
- Reparto comunidad: 60% Agencia / 40% Xisco
- Ventas fuera: 100% Agencia

---

## 🔗 URLs Importantes
- Repo: `feature/bot-operativa` branch
- SaaS (prod): https://bot.refuelparts.com
- MetaApi docs: https://metaapi.cloud/docs/api/
