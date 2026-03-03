---
description: Plan a new feature with architecture review before coding
model: inherit
---

Plan the feature: $ARGUMENTS

## Steps
1. Read CLAUDE.md and tasks/todo.md for current context
2. Read tasks/lessons.md for past learnings
3. Enter **plan mode** — DO NOT write code yet
4. Analyze requirements and identify:
   - Which files need changes
   - Database schema changes (if any)
   - API changes needed
   - UI components affected
   - Multi-tenancy implications
5. Write plan to `tasks/todo.md` with checkboxes
6. Ask the trading-architect agent to review the plan
7. Only after architect approval, proceed with implementation
8. After implementation, invoke trading-qa agent for review

Remember: this is a **financial application**. Plan thoroughly.
