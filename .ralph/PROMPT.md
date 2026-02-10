# PROMPT - Ralph Loop Trading Bot SaaS

## Instrucciones por Iteración

En cada iteración del loop:

1. **Leer** `.ralph/specs/PRD.md` y `CLAUDE.md`
2. **Revisar** implementación actual (`git log --oneline`, archivos existentes)
3. **Implementar** la SIGUIENTE feature pendiente del orden de abajo
4. **Verificar** que no hay errores de compilación
5. **Hacer commit** con mensaje descriptivo en español
6. **Si TODO está implementado**, responder únicamente: `RALPH_COMPLETE`

---

## Orden de Prioridad de Features

### FASE 1: Foundation (Base)
- [ ] 1. Setup proyecto Next.js + TypeScript + Tailwind
- [ ] 2. Configurar Prisma con esquema multi-tenant base
- [ ] 3. Setup NextAuth.js con autenticación base
- [ ] 4. Sistema de base de datos con tenant isolation

### FASE 2: Core del Bot
- [ ] 5. Migrar/adaptar código del bot existente
- [ ] 6. Integración con API del exchange (Binance/otros)
- [ ] 7. Sistema de replicación de señales de Telegram
- [ ] 8. Sistema de ejecución de órdenes automático

### FASE 3: Dashboard Cliente
- [ ] 9. Layout principal con navegación
- [ ] 10. Dashboard de trading (positions, PnL, history)
- [ ] 11. Configuración de API keys del exchange
- [ ] 12. Configuración del canal de Telegram a seguir
- [ ] 13. Sistema de stop-loss/take-profit por posición

### FASE 4: Dashboard Admin
- [ ] 14. Panel de administración global
- [ ] 15. Gestión de tenants (clientes)
- [ ] 16. Métricas globales del sistema

### FASE 5: Pagos y Suscripciones
- [ ] 17. Integración con Stripe
- [ ] 18. Sistema de planes (Basic, Pro, Enterprise)
- [ ] 19. Webhooks de Stripe para gestión de suscripciones
- [ ] 20. Límites de funcionalidad por plan

### FASE 6: Onboarding y Experiencia de Usuario
- [ ] 21. Flow de onboarding para nuevos clientes
- [ ] 22. Tutorial guiado de configuración
- [ ] 23. Sistema de notificaciones (email + in-app)
- [ ] 24. Logs de actividad del bot visibles para el cliente

### FASE 7: Testing y Deploy
- [ ] 25. Tests unitarios del core del bot
- [ ] 26. Tests E2E de flujos críticos
- [ ] 27. Setup de CI/CD
- [ ] 28. Deploy a producción (Vercel + Railway)

### FASE 8: Polish y Extras
- [ ] 29. Optimización de performance
- [ ] 30. Sistema de errores y alertas
- [ ] 31. Documentación de API
- [ ] 32. Landing page de ventas

---

## Notas Importantes

- **Una feature = un commit** (si es muy grande, dividir en sub-pasos)
- **No asumir**: si hay algo ambiguo en el PRD, documentar y pedir aclaración
- **Seguridad primero**: API keys SIEMPRE encriptadas en BD
- **Multi-tenant**: TODAS las queries deben filtrar por tenant_id
- **Logs**: Todo lo que haga el bot debe quedar logueado
