# Trading Bot SaaS - Lecciones Aprendidas

## Errores Comunes
| Fecha | Error | Cómo evitarlo |
|-------|-------|---------------|
| 2026-03-12 | Editar código y dejar fragmentos duplicados que causan syntax errors | Siempre leer el contexto alrededor del cambio; verificar que no quedó código duplicado |
| 2026-03-12 | Mover código que depende de variables definidas más adelante en el componente | Mantener el orden lógico: primero defines las variables, luego las usas |

## Patrones que Funcionan
- **Persistencia en localStorage**: Inicializar estado con función `() => { ... }` que lee de localStorage en mount
- **Atajos de teclado globales**: Usar eventos custom (`window.dispatchEvent(new CustomEvent(...))`) para comunicación entre componentes
- **Progreso estimado frontend**: Simular progreso con curva de desaceleración mientras la API es síncrona, sin necesidad de modificar backend

## Anti-patrones a Evitar
- Crear múltiples definiciones de la misma variable en diferentes partes del componente
- Editar código en medio de bloques sin verificar el contexto completo

---

## Recordatorios
- Siempre filtrar por `tenantId`
- Validar inputs con Zod
- NO usar `any`
