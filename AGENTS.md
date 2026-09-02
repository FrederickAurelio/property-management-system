# Cabin PMS — Agent Brief

Custom property management monorepo. Product plan: `_docs/cabin-pms-client-plan.md`.

## How to write AGENTS.md and `.mdc` rules

Short source of truth — **not** a changelog and **not** a dump of today’s incident.

- **General over specific.** Write the reusable rule (“if 2+ apps need the same types → `packages/`”), not the one-off (“don’t copy `ApiErrorCode`”).
- **Rewrite, don’t append.** When decisions change, replace the section. Never stack “also…” notes.
- **One job per file.** Root = repo-wide. App/package files = that folder only. One `.mdc` = one concern.
- **Locked decisions only.** Stack, phase, hard don’ts. Skip tutorials, speculation, and chat recap.
- **Prefer bullets and tables.** Target ~one screen when possible.
- **Link out** for depth — don’t duplicate `_docs/` or the same paragraph in three places.
- **Delete stale lines.** Drop finished “not yet” noise; update status in place.
- **Examples are optional.** At most one short example; the rule must still work if that example is removed.

**When a `.mdc` outgrows one file:** split by concern, not by milestone. Split `apps/<app>/**` into `<app>-<concern>.mdc` (own tight `globs`, e.g. `api-http.mdc`, `api-prisma.mdc`, `api-auth.mdc`) only when the file stops fitting one screen **and** mixes 2+ stable concerns, or one concern inside it keeps getting violated and needs a tighter glob. Shipping a new module/feature is never a reason to split — fold it into the existing concern bullet or into that app's `AGENTS.md`.

Same policy for agents: [`.cursor/rules/agents-writing.mdc`](.cursor/rules/agents-writing.mdc).

## Layout

```text
apps/api   → Nest API (source of truth)     @cabin/api
apps/pms   → Staff PMS UI (Phase 1 prod)    @cabin/pms
apps/web   → Public browse/book (Phase 2)   @cabin/web (Vite + prerender; stack locked)
packages/  → Shared libs for 2+ apps        @cabin/*
_docs/     → Product plan + locked design notes (inventory, reservations, …)
docker-compose.yml     → VPS full stack (postgres + api + pms + web + garage + Loki; FE :8080 · web :3050 · archive S3 :3900 · archive GET :3910)
docker-compose.dev.yml → local Postgres + Garage + optional logs (`pnpm db:up` / `archive:up` / `logs:up`)
```

One backend. Both frontends call `apps/api`. Package manager: **pnpm** only (never `npm i` inside an app).

**Deploy:** push to `release` → GitHub Actions builds images (official apt/npm on GH runners) → push GHCR → VPS pulls + migrate. Path `~/property-management-system`. VPS `.env`: runtime secrets + optional `APT_MIRROR`/`NPM_REGISTRY` (only for emergency **direct** rebuild; unused by GHCR pull). Direct-on-VPS backup: `.github/workflows/deploy-vps.direct.backup.yml`. **No domain yet:** open host ports (pms/web/archive). **Later HTTPS + domains:** edge reverse proxy on 443, close interim ports, set `COOKIE_SECURE=true` + HTTPS `CORS_ORIGINS` / `ARCHIVE_*` — checklist [`deploy/garage/README.md`](deploy/garage/README.md) § Domain HTTPS cutover · [`_docs/archive-storage.md`](_docs/archive-storage.md). Ops request logs: PMS `/request-logs` (Loki unpublished) — [`_docs/request-logs.md`](_docs/request-logs.md) · [`deploy/loki/README.md`](deploy/loki/README.md).

**Phase framing (locked):** business already runs on OTA + manual/walk-in. **Phase 1** = production **staff** PMS for that reality (calendar, reservations, check-in/out, **money/DP**, reports, **iCal import**). **No OTA email ingest.** **Phase 2** = **customer** booking FE only — same `Reservation` + `domain/` model (`source=WEBSITE`). Phase 2 is not “when bookings or payments start.” Design: [`_docs/reservations-design.md`](_docs/reservations-design.md).

**Shared packages:** if two apps need the same types/constants/pure helpers, put them in `packages/` and depend with `workspace:*` — do not copy between apps. New package or new app dep → also update Dockerfile `COPY packages/...` layers (local `pnpm` alone won’t catch it). How-to: [`packages/README.md`](packages/README.md) · tooling: [`.cursor/rules/monorepo-tooling.mdc`](.cursor/rules/monorepo-tooling.mdc).

**External paid services** (media CDN, future payment gateway, email, …): Nest **capability port + vendor adapters** under `apps/api/src/integrations/` — see [`_docs/integrations-pattern.md`](_docs/integrations-pattern.md). Do not hard-wire vendor SDKs into controllers.

**IDE:** open [`cabin.code-workspace`](cabin.code-workspace). If IDE shows `no-unsafe-*` but `pnpm --filter @cabin/api lint` is clean → fix workspace, **do not change code** ([`.cursor/rules/monorepo-eslint-types.mdc`](.cursor/rules/monorepo-eslint-types.mdc)).

## Locked stack (Phase 1)

| App | Stack | Scaffold |
|-----|--------|----------|
| `api` | NestJS · TypeScript · PostgreSQL · Prisma 6 · session cookies + Guards | Auth + inventory + **reservations/money** done |
| `pms` | React · Vite · TypeScript · Tailwind CSS v4 · shadcn/ui (radix-nova) · dev `:5173` | Auth + inventory + **reservations desk on Nest** |
| `web` | React · Vite · TypeScript · Tailwind CSS v4 · shadcn/ui (radix-nova) · `@cabin/ui-tokens` · i18n en/id/zh · dev `:5174` · prerender/SSG · CDN in prod | Phase 2 customer FE (scaffold; stack locked) |

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
| Local Loki | `pnpm logs:up` / `logs:down` (`127.0.0.1:3100`) |
| Prisma generate | `pnpm prisma:generate` |
| Prisma migrate | `pnpm prisma:migrate` |
| VPS stack | `docker compose up -d --build` (default `docker-compose.yml`) |
| API dev | `pnpm --filter @cabin/api dev` |
| PMS dev | `pnpm --filter @cabin/pms dev` (`:5173`) |
| Web dev | `pnpm --filter @cabin/web dev` (`:5174`) |
| Add dep to one app | `pnpm --filter @cabin/api add <pkg>` |

Local DB: `localhost:${POSTGRES_PORT:-5432}` · db `cabin_pms` · **one** `.env` at repo root (see `.env.example`). VPS (no domain): host ports **8080** (PMS) · **3050** (web) · **3900** (Garage S3) · **3910** (archive GET); api/postgres/loki stay on Docker network.

## Product path

| Phase | Focus |
|-------|--------|
| **1 (now)** | **Prod staff PMS** for live manual + OTA: auth, units, calendar, reservations (incl. **total/paid/DP**), check-in/out, reports → **iCal hub** (PMS export → each OTA; import each OTA → PMS) + Sync now. Migrate off OTA↔OTA mesh when PMS trusted. **No email ingest.** |
| **2** | Customer `web` browse/book FE + public API + PMS iCal **export** hub — **same** reservation/money model |
| **3** | Paid Channel Manager only if iCal delay/scale hurts |

OTA sync: **hub topology** (each OTA imports PMS export only; PMS imports each OTA). Mesh bootstrap OK until PMS trusted — then drop peer OTA↔OTA links. Hub migration + why: [`_docs/reservations-design.md`](_docs/reservations-design.md) §9. No extranet scraping.  
`CONFIRMED` = ops-booked, **not** fully paid — money is a separate axis (`paymentStatus`).  
iCal stubs → `UNCONFIRMED` until staff enrich guest + money.

## Build order

1. Auth + units ← **done**
2. Manual reservations + money/DP ← **done** (Nest `/staff/reservations` + PMS live; desk boards on `/reservations`, Arrivals includes overdue)
3. Calendar (same reservation rows)
4. Basic reports
5. iCal **export** per unit (PMS → OTA) + **import** + Sync now (+ `UNCONFIRMED` enrich / missing-feed warnings) ← **done**
6. Customer website booking + iCal export (`web`) — Phase 2
7. Evaluate CM — Phase 3

Money quote (locked): stay Total suggests `periodCount ×` matching rack (`billingPeriod` + daily/monthly/yearly prices); cash = `PaymentMovement` (amounts append-only except latest undo within 5 min; optional `proofImages` replace-set); Paid = sum — see [`_docs/reservations-design.md`](_docs/reservations-design.md) §6.

## Navigation

| Work in | Read |
|---------|------|
| Repo / architecture | This file + `_docs/cabin-pms-client-plan.md` |
| Reservations / money / iCal | [`_docs/reservations-design.md`](_docs/reservations-design.md) |
| Calendar page (unit × days) | [`_docs/calendar-design.md`](_docs/calendar-design.md) |
| Dashboard (desk today) | [`_docs/dashboard-design.md`](_docs/dashboard-design.md) |
| Reports (owner period) | [`_docs/reports-design.md`](_docs/reports-design.md) |
| Shared libs | `packages/README.md` + that package’s `AGENTS.md` |
| External vendors (media, payments, …) | [`_docs/integrations-pattern.md`](_docs/integrations-pattern.md) · media: [`_docs/media-upload-strategy.md`](_docs/media-upload-strategy.md) |
| API request logs (Loki + PMS) | [`_docs/request-logs.md`](_docs/request-logs.md) · [`deploy/loki/README.md`](deploy/loki/README.md) |
| Postgres backup (VPS) | [`_docs/database-backup.md`](_docs/database-backup.md) · [`deploy/backup/backup-db.sh`](deploy/backup/backup-db.sh) · [`deploy/vps-migrate-deploy.sh`](deploy/vps-migrate-deploy.sh) |
| Backend | `apps/api/AGENTS.md` (audience: `staff` / `domain` / `public`) |
| Staff UI | `apps/pms/AGENTS.md` |
| Public site | `apps/web/AGENTS.md` + `apps/web/PRODUCT.md` (Impeccable) |

Constraints: `.cursor/rules/` — layered entry + concern globs per app (map: [`.cursor/rules/README.md`](.cursor/rules/README.md)). Commits: `.cursor/rules/commits.mdc`. Tooling/packages: `.cursor/rules/monorepo-tooling.mdc`.

## Hard don’ts

- Promise zero double-booking from iCal alone
- Remote OTA “Import now” bots / scraping
- Claim iCal syncs prices
- Rip OTA↔OTA mesh before PMS export is verified on all OTAs (hub migration checklist: `_docs/reservations-design.md` §9)
- Defer staff reservation **money/DP** until Phase 2 web — Phase 1 PMS must track it for live desk
- OTA **email ingest** / ping / quick-confirm parsers — out; use iCal + staff enrich
- Treat Phase 2 as inventing a second booking/payment model — web reuses `domain/reservations`
- Default Phase 2 `web` to Next.js — locked default is Vite + React + prerender/SSG; Next only by explicit decision
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
