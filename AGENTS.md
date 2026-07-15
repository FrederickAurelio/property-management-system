# Cabin PMS — Agent Brief

Custom property management monorepo. Product plan: `.docs/cabin-pms-client-plan.md`.

## How to write AGENTS.md

Keep every `AGENTS.md` a short source of truth — not a changelog.

- **Rewrite, don’t append.** When decisions change, replace the old section.
- **One job per file.** Root = repo-wide. App files = that app only. No copy-paste walls.
- **Locked decisions only.** Stack, phase, hard don’ts. Skip tutorials and speculation.
- **Prefer bullets and tables** over long prose. Target ~one screen when possible.
- **Link out** to `.docs/` or rules for depth — don’t duplicate the client plan.
- **Delete stale lines.** If Phase 1 is done, drop “not yet” noise; update build order.
- **Never** grow by stacking “also…” notes. Edit in place or the file becomes useless.

## Layout

```text
apps/api   → Nest API (source of truth)
apps/pms   → Staff PMS UI (Phase 1)
apps/web   → Public browse/book (Phase 2)
packages/  → Shared code when two apps need it
.docs/     → Product plan
```

One backend. Both frontends call `apps/api`.

## Locked stack (Phase 1)

| App | Stack |
|-----|--------|
| `api` | NestJS · TypeScript · PostgreSQL · Prisma · session cookies + Guards |
| `pms` | React · Vite · TypeScript · Tailwind CSS · shadcn/ui |
| `web` | **Undecided** (Phase 2 — discuss later; scaffold only for now) |

Do not introduce Express+Mongo, a second API, or a second booking database.

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
| Backend | `apps/api/AGENTS.md` |
| Staff UI | `apps/pms/AGENTS.md` |
| Public site | `apps/web/AGENTS.md` |

Constraints: `.cursor/rules/` (globbed per app). Commits: `.cursor/rules/commits.mdc`.

## Hard don’ts

- Promise zero double-booking from iCal alone
- Remote OTA “Import now” bots / scraping
- Claim iCal syncs prices
- Rip OTA↔OTA iCal before PMS is trusted
- Channel Manager or `web` booking before Phase 1 ops MVP is solid

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
