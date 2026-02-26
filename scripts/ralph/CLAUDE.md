# Ralph Agent Instructions — Trading Bot SaaS

You are an autonomous coding agent working on the Trading Bot SaaS project.

## Project Context

- **Stack:** Next.js 15 + tRPC v11 + Prisma + SQLite (dev) / PostgreSQL (prod)
- **Auth:** NextAuth.js v5 beta
- **UI:** Tailwind CSS + shadcn/ui
- **Multi-tenant:** Every query filters by tenantId

## Your Task

1. Read the PRD at `scripts/ralph/prd.json`
2. Read the progress log at `scripts/ralph/progress.txt` (check **Codebase Patterns** section first)
3. Check you're on the correct branch from PRD `branchName`. If not, check it out or create from main.
4. Pick the **highest priority** user story where `passes: false`
5. Implement that single user story
6. Run quality checks:
   - `npx tsc --noEmit` (typecheck)
   - `npm run build` (build check)
   - `npm test` (if tests exist for the feature)
7. If checks pass, commit ALL changes with message: `feat: [Story ID] - [Story Title]`
8. Update the PRD to set `passes: true` for the completed story
9. Append your progress to `scripts/ralph/progress.txt`

## Code Conventions

- Use tRPC routers in `server/api/trpc/routers/`
- Prisma schema at `prisma/schema.prisma`
- Pages in `app/(dashboard)/` or `app/(auth)/`
- Components in `components/`
- Lib/utils in `lib/`
- Always use `tenantId` for multi-tenant isolation
- Use shadcn/ui components (already installed)
- Follow existing patterns in the codebase

## Progress Report Format

APPEND to scripts/ralph/progress.txt (never replace):
```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered
  - Gotchas encountered
---
```

## Consolidate Patterns

If you discover a **reusable pattern**, add it to the `## Codebase Patterns` section at the TOP of progress.txt:

```
## Codebase Patterns
- Example: All API routes use tenantId from session
- Example: shadcn components imported from @/components/ui/
```

## Quality Requirements

- ALL commits must pass typecheck (`npx tsc --noEmit`)
- Do NOT commit broken code
- Keep changes focused and minimal — ONE story per iteration
- Follow existing code patterns in the project

## Stop Condition

After completing a story, check if ALL stories have `passes: true`.

If ALL complete → reply with: COMPLETE
If stories remain → end normally (next iteration picks up)

## Important

- Work on ONE story per iteration
- Commit after each story
- Keep the build green
- Read Codebase Patterns in progress.txt before starting
