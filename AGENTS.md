# Cabin / Apartment PMS — Agent Brief

Monorepo for a custom property management system. Read `.docs/cabin-pms-client-plan.md` before large product decisions.

## Layout

```text
apps/api   → Backend (source of truth)
apps/pms   → Staff ops frontend (Phase 1)
apps/web   → Public browse/book frontend (Phase 2)
packages/  → Shared types later (optional)
.docs/     → Product plan & research
```

One BE, two FEs. Both frontends hit `apps/api`. Do not invent a second backend.

## Product path (locked)

- **Approach B** — custom PMS
- **Phase 1 (B2a) now:** ops PMS + email/WhatsApp ping + quick confirm
- **Phase 2 (B2b):** website booking + PMS as iCal hub
- **Phase 3 (B1):** optional paid Channel Manager — only if iCal delay/scale hurts

OTA sync today stays **native iCal** (Booking.com · Airbnb · Agoda). Do not scrape OTA extranets or bot “Import now”.

## Build order (do not skip ahead)

1. Auth + units + calendar + manual reservations (`api` + `pms`)
2. Check-in / check-out + daily ops views
3. Basic reports
4. Email ingest + notify + quick-confirm
5. iCal import into PMS + Sync now
6. Website booking + iCal export (`web` + hub) — Phase 2
7. Evaluate CM — Phase 3

## Agent navigation

| Working in | Read first |
|------------|------------|
| Repo-wide / architecture | This file + `.docs/cabin-pms-client-plan.md` |
| Backend | `apps/api/AGENTS.md` |
| Staff UI | `apps/pms/AGENTS.md` |
| Public site | `apps/web/AGENTS.md` |

Each app has an `AGENTS.md`. Root `.cursor/rules/` applies by glob when editing that app.

## Hard don’ts

- Promise zero double-booking on iCal alone
- Promise remote OTA “Import now / Refresh” from PMS
- Claim iCal syncs prices (prices stay manual per OTA until CM)
- Rip their OTA↔OTA iCal mesh before PMS is trusted
- Build Channel Manager / Channex in Phase 1
- Start `apps/web` booking before Phase 1 ops MVP is solid

## Inventory model

Unique **unit** calendars (Cabin 01, 02, …), not hotel allotment-first:

```text
property → unit_type (optional) → unit → reservations / blocks
```

## Vibe coding notes

- Keep changes scoped to the app you are in unless the task spans API + UI.
- Prefer small vertical slices (e.g. units CRUD end-to-end) over big unfinished frameworks.
- When unsure of product intent, prefer Phase 1 ops over public booking polish.

## Git & quality gates

Commits use **Conventional Commits** with a **required scope**:

```text
type(scope): summary
```

Scopes: `api` | `pms` | `web` | `packages` | `repo` | `deps`

Husky hooks (do not skip unless explicitly asked):

| Hook | Runs |
|------|------|
| `pre-commit` | `pnpm typecheck` (all apps) |
| `commit-msg` | commitlint |

Useful scripts:

```bash
pnpm typecheck          # api + pms + web
pnpm typecheck:api
pnpm typecheck:pms
pnpm typecheck:web
```

See `.cursor/rules/commits.mdc`.
