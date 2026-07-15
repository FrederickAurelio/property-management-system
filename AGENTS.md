# Cabin PMS — Agent Brief

Custom property management monorepo. Product plan: `.docs/cabin-pms-client-plan.md`.

## How to write AGENTS.md and `.mdc` rules

Short source of truth — **not** a changelog and **not** a dump of today’s incident.

- **General over specific.** Write the reusable rule (“if 2+ apps need the same types → `packages/`”), not the one-off (“don’t copy `ApiErrorCode`”).
- **Rewrite, don’t append.** When decisions change, replace the section. Never stack “also…” notes.
- **One job per file.** Root = repo-wide. App/package files = that folder only. One `.mdc` = one concern.
- **Locked decisions only.** Stack, phase, hard don’ts. Skip tutorials, speculation, and chat recap.
- **Prefer bullets and tables.** Target ~one screen when possible.
- **Link out** for depth — don’t duplicate `.docs/` or the same paragraph in three places.
- **Delete stale lines.** Drop finished “not yet” noise; update status in place.
- **Examples are optional.** At most one short example; the rule must still work if that example is removed.

Same policy for agents: [`.cursor/rules/agents-writing.mdc`](.cursor/rules/agents-writing.mdc).

## Layout

```text
apps/api   → Nest API (source of truth)     @cabin/api
apps/pms   → Staff PMS UI (Phase 1)         @cabin/pms
apps/web   → Public browse/book (Phase 2)   @cabin/web (scaffold only)
packages/  → Shared libs for 2+ apps        @cabin/*
.docs/     → Product plan
docker-compose.yml → local Postgres now; api/pms/web later on cabin-net
```

One backend. Both frontends call `apps/api`. Package manager: **pnpm** only (never `npm i` inside an app).

**Shared packages:** if two apps need the same types/constants/pure helpers, put them in `packages/` and depend with `workspace:*` — do not copy between apps. How-to: [`packages/README.md`](packages/README.md) · tooling: [`.cursor/rules/monorepo-tooling.mdc`](.cursor/rules/monorepo-tooling.mdc).

**IDE:** open [`cabin.code-workspace`](cabin.code-workspace) so ESLint/TS use per-app CWD. Details: monorepo-tooling rule. Do not silence `no-unsafe-*` to hide workspace misconfig.

## Locked stack (Phase 1)

| App | Stack | Scaffold |
|-----|--------|----------|
| `api` | NestJS · TypeScript · PostgreSQL · Prisma 6 · session cookies + Guards | Auth + Admin roles wired; domain next |
| `pms` | React · Vite · TypeScript · Tailwind CSS v4 · shadcn/ui (radix-nova) | Ready to build screens |
| `web` | **Undecided** (Phase 2) | Placeholder only |

Do not introduce Express+Mongo, a second API, or a second booking database.

## Commands

From **repo root**:

| Task | Command |
|------|---------|
| Install | `pnpm install` |
| Typecheck (husky) | `pnpm typecheck` |
| Lint (per app) | `pnpm lint` |
| Postgres up | `pnpm db:up` |
| Postgres down | `pnpm db:down` |
| Prisma generate | `pnpm prisma:generate` |
| Prisma migrate | `pnpm prisma:migrate` |
| API dev | `pnpm --filter @cabin/api dev` |
| PMS dev | `pnpm --filter @cabin/pms dev` |
| Add dep to one app | `pnpm --filter @cabin/api add <pkg>` |

Local DB: `localhost:${POSTGRES_PORT:-5432}` · db `cabin_pms` · **one** `.env` at repo root (see `.env.example`).

## Product path

| Phase | Focus |
|-------|--------|
| **1 (now)** | Ops PMS: auth, units, calendar, reservations, check-in/out, reports → then email ping + quick-confirm → iCal import |
| **2** | `web` booking + PMS iCal export hub |
| **3** | Paid Channel Manager only if iCal delay/scale hurts |

OTA sync today: native iCal (Booking.com · Airbnb · Agoda). No extranet scraping.

## Build order

1. Auth + units + calendar + manual reservations (`api` + `pms`)
2. Check-in / check-out + daily ops
3. Basic reports
4. Email ingest + notify + quick-confirm
5. iCal import + Sync now
6. Website booking + iCal export (`web`) — Phase 2
7. Evaluate CM — Phase 3

## Navigation

| Work in | Read |
|---------|------|
| Repo / architecture | This file + `.docs/cabin-pms-client-plan.md` |
| Shared libs | `packages/README.md` + that package’s `AGENTS.md` |
| Backend | `apps/api/AGENTS.md` |
| Staff UI | `apps/pms/AGENTS.md` |
| Public site | `apps/web/AGENTS.md` |

Constraints: `.cursor/rules/` (globbed per app). Commits: `.cursor/rules/commits.mdc`. Tooling/packages: `.cursor/rules/monorepo-tooling.mdc`.

## Hard don’ts

- Promise zero double-booking from iCal alone
- Remote OTA “Import now” bots / scraping
- Claim iCal syncs prices
- Rip OTA↔OTA iCal before PMS is trusted
- Channel Manager or `web` booking before Phase 1 ops MVP is solid
- Copy the same types/constants into two apps — use `packages/` instead

## Inventory

```text
property → unit_type (optional) → unit → reservations / blocks
```

One calendar per **unit**. Overlap safety is enforced in Postgres (not UI-only).

## Quality gates

```text
type(scope): summary
```

Scopes: `api` | `pms` | `web` | `packages` | `repo` | `deps`

- `pre-commit` → `pnpm typecheck`
- `commit-msg` → commitlint
- Do not `--no-verify` unless the user asks

```bash
pnpm typecheck
```
