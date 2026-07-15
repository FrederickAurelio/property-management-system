---
name: commit-messages
description: Drafts Conventional Commit messages with required monorepo scopes. Use when the user asks to commit, write a commit message, or fix a commitlint failure.
---

# Commit messages

## Format

```text
type(scope): summary
```

| Field | Rules |
|-------|--------|
| type | feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert |
| scope | **required** — api, pms, web, packages, repo, deps |
| summary | imperative; no trailing period; header ≤ 100 chars |

## Scope picker

| Change lives in | Scope |
|-----------------|-------|
| `apps/api` | `api` |
| `apps/pms` | `pms` |
| `apps/web` | `web` |
| `packages/*` | `packages` |
| Root tooling, husky, AGENTS, docs | `repo` |
| Dependency bumps only | `deps` |

If multiple apps change in one commit, prefer the primary app scope, or split commits. Use `repo` for cross-cutting scaffold/tooling.

## Pre-commit gate

Before committing, ensure:

```bash
pnpm typecheck
```

Husky runs this on `pre-commit`. Fix TS errors in all three apps before retrying.

## Agent workflow

1. `git status` / `git diff` / `git log` (style)
2. Stage relevant files (never secrets)
3. Message via HEREDOC matching commitlint
4. If hook fails: fix, then **new** commit (do not `--no-verify`)
