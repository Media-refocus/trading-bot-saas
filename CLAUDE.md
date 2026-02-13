# 🚀 PROMPT PARA NUEVA TERMINAL (Claude Code)

## 📋 ESTADO ACTUAL - 13 FEB 2026 (SESIÓN COMPLETADA)

### ✅ LO QUE ESTÁ FUNCIONANDO

**1. Backtester Web Completo**
- UI en `app/(dashboard)/backtester/page.tsx`
- Router tRPC en `server/api/trpc/routers/backtester.ts`
- Motor de simulación en `lib/backtest-engine.ts`
- Parser de señales en `lib/parsers/signals-csv.ts`
- **NUEVO:** Loader de ticks reales en `lib/parsers/ticks-loader.ts`

**2. Sistema de Autenticación**
- Registro: `app/api/register/route.ts`
- Login: Usa NextAuth con credentials
- Base de datos SQLite funcionando

**3. Datos Disponibles**
- `signals_simple.csv`: 388 señales (Oct 2025 - Feb 2026)
- `signals_parsed.csv`: 154 señales (Jun 2024 - Ene 2026)
- `docs/telegram_raw_messages.csv`: 27,439 mensajes raw

**4. Ticks MT5**
- `data/ticks/XAUUSD_2024.csv.gz`: Solo 2-5 enero 2024 (incompleto)

---

### ⚠️ PROBLEMA PENDIENTE - TICKS INSUFICIENTES

**Situación:** El archivo de ticks solo tiene datos del 2-5 enero 2024, pero las señales empiezan en junio 2024. No hay superposición temporal.

**Solución:** Descargar más ticks con MT5:
```bash
# Con MT5 abierto en el PC:
python scripts/download_mt5_ticks.py --start 2024-06-01 --end 2026-02-13
```

---

## 🎯 PRÓXIMOS PASOS

1. **Descargar ticks completos** de MT5 (Jun 2024 - Feb 2026)
2. **Probar backtest con ticks reales** una vez descargados
3. **Mejorar parser de señales** para extraer más información

---

## 📂 ARCHIVOS CLAVE

| Archivo | Descripción |
|---------|-------------|
| `lib/parsers/ticks-loader.ts` | **NUEVO** - Loader de ticks reales desde gzip |
| `lib/backtest-engine.ts` | Motor de simulación con grid y trailing SL |
| `server/api/trpc/routers/backtester.ts` | Router tRPC con endpoints |
| `scripts/download_mt5_ticks.py` | Script para descargar ticks de MT5 |
| `scripts/parse_telegram_signals.py` | Parser de mensajes de Telegram |

---

## 🔧 STACK TECNOLÓGICO

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS
- **Backend:** tRPC v11, Prisma ORM
- **UI:** shadcn/ui (Button, Card, Input, Label)
- **Database:** SQLite (desarrollo local) / PostgreSQL (producción)
- **Auth:** NextAuth con credentials provider

---

## 🚀 ARRANCAR

```bash
cd C:\Users\guill\Projects\trading-bot-saas
npm run dev
```

Abrir http://localhost:3000/backtester
