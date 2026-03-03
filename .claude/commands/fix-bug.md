---
description: Fix a bug with proper diagnosis and verification
argument-hint: [description-of-bug]
model: inherit
---

Fix this bug: $ARGUMENTS

## Protocol
1. **Diagnose** — Read error logs, reproduce the issue, identify root cause
2. **Check lessons** — Read `tasks/lessons.md` for similar past bugs
3. **Fix** — Implement the minimal fix that addresses the root cause
4. **Verify** — Run tests, check the fix works, verify no regressions
5. **Document** — Add lesson to `tasks/lessons.md` if this is a new pattern
6. **Commit** — `git commit` with descriptive message (fix: ...)

Do NOT make unrelated changes. Focus only on the bug.
