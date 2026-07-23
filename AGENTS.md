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

**When a `.mdc` outgrows one file:** split by concern, not by milestone. Split `apps/<app>/**` into `<app>-<concern>.mdc` (own tight `globs`, e.g. `api-http.mdc`, `api-prisma.mdc`, `api-auth.mdc`) only when the file stops fitting one screen **and** mixes 2+ stable concerns, or one concern inside it keeps getting violated and needs a tighter glob. Shipping a new module/feature is never a reason to split — fold it into the existing concern bullet or into that app's `AGENTS.md`.

Same policy for agents: [`.cursor/rules/agents-writing.mdc`](.cursor/rules/agents-writing.mdc).

## Layout

```text
apps/api   → Nest API (source of truth)     @cabin/api
apps/pms   → Staff PMS UI (Phase 1 prod)    @cabin/pms
apps/web   → Public browse/book (Phase 2)   @cabin/web (scaffold only)
packages/  → Shared libs for 2+ apps        @cabin/*
.docs/     → Product plan
_docs/     → Locked design notes (inventory, reservations, …)
docker-compose.yml     → VPS full stack (postgres + api + pms; only FE :8080 published)
docker-compose.dev.yml → local Postgres only (host port for Nest/Vite)
```

One backend. Both frontends call `apps/api`. Package manager: **pnpm** only (never `npm i` inside an app).

**Deploy:** push to `release` → GitHub Actions builds images (official apt/npm on GH runners) → push GHCR → VPS pulls + migrate. Path `~/property-management-system`. VPS `.env`: runtime secrets + optional `APT_MIRROR`/`NPM_REGISTRY` (only for emergency **direct** rebuild; unused by GHCR pull). Direct-on-VPS backup: `.github/workflows/deploy-vps.direct.backup.yml`. Later HTTPS: set `COOKIE_SECURE=true` and update `CORS_ORIGINS`.

**Phase framing (locked):** business already runs on OTA + manual/walk-in. **Phase 1** = production **staff** PMS for that reality (calendar, reservations, check-in/out, **money/DP**, reports, **iCal import**). **No OTA email ingest.** **Phase 2** = **customer** booking FE only — same `Reservation` + `domain/` model (`source=WEBSITE`). Phase 2 is not “when bookings or payments start.” Design: [`_docs/reservations-design.md`](_docs/reservations-design.md).

**Shared packages:** if two apps need the same types/constants/pure helpers, put them in `packages/` and depend with `workspace:*` — do not copy between apps. How-to: [`packages/README.md`](packages/README.md) · tooling: [`.cursor/rules/monorepo-tooling.mdc`](.cursor/rules/monorepo-tooling.mdc).

**IDE:** open [`cabin.code-workspace`](cabin.code-workspace). If IDE shows `no-unsafe-*` but `pnpm --filter @cabin/api lint` is clean → fix workspace, **do not change code** ([`.cursor/rules/monorepo-eslint-types.mdc`](.cursor/rules/monorepo-eslint-types.mdc)).

## Locked stack (Phase 1)

| App | Stack | Scaffold |
|-----|--------|----------|
| `api` | NestJS · TypeScript · PostgreSQL · Prisma 6 · session cookies + Guards | Auth + inventory + **reservations/money** done |
| `pms` | React · Vite · TypeScript · Tailwind CSS v4 · shadcn/ui (radix-nova) | Auth + inventory + **reservations desk on Nest** |
| `web` | **Undecided** (Phase 2 customer FE) | Placeholder only |

Do not introduce Express+Mongo, a second API, or a second booking database.

## Commands

From **repo root**:

| Task | Command |
|------|---------|
| Install | `pnpm install` |
| Typecheck (husky) | `pnpm typecheck` |
| Lint (per app) | `pnpm lint` |
| Postgres up | `pnpm db:up` (`docker-compose.dev.yml`) |
| Postgres down | `pnpm db:down` |
| Prisma generate | `pnpm prisma:generate` |
| Prisma migrate | `pnpm prisma:migrate` |
| VPS stack | `docker compose up -d --build` (default `docker-compose.yml`) |
| API dev | `pnpm --filter @cabin/api dev` |
| PMS dev | `pnpm --filter @cabin/pms dev` |
| Add dep to one app | `pnpm --filter @cabin/api add <pkg>` |

Local DB: `localhost:${POSTGRES_PORT:-5432}` · db `cabin_pms` · **one** `.env` at repo root (see `.env.example`). VPS: only host port **8080** (PMS nginx); api/postgres stay on Docker network.

## Product path

| Phase | Focus |
|-------|--------|
| **1 (now)** | **Prod staff PMS** for live manual + OTA: auth, units, calendar, reservations (incl. **total/paid/DP**), check-in/out, reports → **iCal export** (block OTAs) + **iCal import** + Sync now. Schema merge-ready for web. **No email ingest.** |
| **2** | Customer `web` browse/book FE + public API + PMS iCal **export** hub — **same** reservation/money model |
| **3** | Paid Channel Manager only if iCal delay/scale hurts |

OTA sync today: native iCal (Booking.com · Airbnb · Agoda). No extranet scraping.  
`CONFIRMED` = ops-booked, **not** fully paid — money is a separate axis (`paymentStatus`).  
iCal stubs → `UNCONFIRMED` until staff enrich guest + money.

## Build order

1. Auth + units ← **done**
2. Manual reservations + money/DP ← **done** (Nest `/staff/reservations` + PMS live; desk boards on `/reservations`, Arrivals includes overdue)
3. Calendar (same reservation rows)
4. Basic reports
5. iCal **export** per unit (PMS → OTA) + **import** + Sync now (+ `UNCONFIRMED` enrich / missing-feed warnings)
6. Customer website booking + iCal export (`web`) — Phase 2
7. Evaluate CM — Phase 3

Money quote (locked): stay Total suggests `nights × UnitType.defaultPriceIdr`; cash = append-only `PaymentMovement`; Paid = sum — see [`_docs/reservations-design.md`](_docs/reservations-design.md) §6.

## Navigation

| Work in | Read |
|---------|------|
| Repo / architecture | This file + `.docs/cabin-pms-client-plan.md` |
| Reservations / money / iCal | [`_docs/reservations-design.md`](_docs/reservations-design.md) |
| Calendar page (unit × days) | [`_docs/calendar-design.md`](_docs/calendar-design.md) |
| Shared libs | `packages/README.md` + that package’s `AGENTS.md` |
| Backend | `apps/api/AGENTS.md` (audience: `staff` / `domain` / `public`) |
| Staff UI | `apps/pms/AGENTS.md` |
| Public site | `apps/web/AGENTS.md` |

Constraints: `.cursor/rules/` — layered entry + concern globs per app (map: [`.cursor/rules/README.md`](.cursor/rules/README.md)). Commits: `.cursor/rules/commits.mdc`. Tooling/packages: `.cursor/rules/monorepo-tooling.mdc`.

## Hard don’ts

- Promise zero double-booking from iCal alone
- Remote OTA “Import now” bots / scraping
- Claim iCal syncs prices
- Rip OTA↔OTA iCal before PMS is trusted
- Defer staff reservation **money/DP** until Phase 2 web — Phase 1 PMS must track it for live desk
- OTA **email ingest** / ping / quick-confirm parsers — out; use iCal + staff enrich
- Treat Phase 2 as inventing a second booking/payment model — web reuses `domain/reservations`
- Channel Manager or `web` booking before Phase 1 ops MVP is solid
- Copy the same types/constants into two apps — use `packages/` instead
- Flat audience-neutral Nest app routes (`/properties`, `/admins`) — use `/staff/...` or `/public/...` (see `apps/api/AGENTS.md`)

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
