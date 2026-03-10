# MT4 Support - ARCHIVED

**Estado:** 📦 Archivado
**Fecha:** 2026-03-10
**Razón:** Enfoque exclusivo en MT5 para lanzamiento inicial

---

## Fase 9: Soporte MT4 + Arquitectura Unificada

> **Nota:** Este trabajo queda archivado para posible reactivación futura.
> No se eliminará código, solo se desprioriza hasta validar el mercado MT5.

### 9.1 EA Cliente Ligero MQL4
**Prioridad**: BAJA (archivada)
**Dependencias**: Fase 2.3 (Stripe) completada
**Tiempo estimado**: 2-3 días

**Objetivo**: EA MQL4 que actúa como cliente ligero, mismo patrón que MT5.

**Tareas**:
- [ ] Portar EA de MQL5 a MQL4 (polling señales, ejecución órdenes)
- [ ] WebRequest al servidor cada 5-10s para señales activas
- [ ] Validación de licencia en OnInit() + cada 24h
- [ ] Kill-switch: si licencia inválida → ExpertRemove()
- [ ] Licencia atada a AccountNumber() del broker
- [ ] Compilar a .ex4 (protección nativa, no decompilable)
- [ ] Tests en cuenta demo con broker MT4

### 9.2 API de Licencias + Señales
**Prioridad**: BAJA (archivada)
**Dependencias**: 9.1
**Tiempo estimado**: 1-2 días

**Tareas**:
- [ ] Endpoint `POST /api/validate-license` (account + key → valid/invalid/expired)
- [ ] Endpoint `GET /api/signals/active` (devuelve señal actual si licencia válida)
- [ ] Webhook Stripe: activar/desactivar licencia automáticamente al pagar/cancelar
- [ ] Rate limiting por cuenta
- [ ] Cache de validación (no golpear DB en cada polling)
- [ ] Logs de acceso por cuenta (auditoría)

### 9.3 Instalador Unificado MT4/MT5
**Prioridad**: BAJA (archivada)
**Dependencias**: 9.1, 9.2
**Tiempo estimado**: 1 día

**Tareas**:
- [ ] Actualizar `install.ps1`: detectar si hay MT4, MT5 o ambos
- [ ] Descargar EA correcto (.ex4 o .ex5) según terminal detectado
- [ ] Copiar EA a carpeta `MQL4/Experts/` o `MQL5/Experts/`
- [ ] Configurar URLs permitidas en WebRequest automáticamente
- [ ] Solicitar license key al cliente durante instalación
- [ ] Verificar conexión al servidor antes de finalizar
- [ ] Script de desinstalación limpia

---

## Reactivación

Para reactivar MT4 support:
1. Mover este archivo a `ROADMAP.md` como Fase 9
2. Verificar compatibilidad con API actual
3. Actualizar estimaciones de tiempo

---

*Archivado por: Vegeta*
*Fecha: 2026-03-10*
