# Cabin PMS — Agent Brief

Custom property management monorepo. Product plan: [`_docs/cabin-pms-client-plan.md`](_docs/cabin-pms-client-plan.md).

## How to write AGENTS.md and `.mdc` rules

Short source of truth — **not** a changelog. Full policy: [`.cursor/rules/agents-writing.mdc`](.cursor/rules/agents-writing.mdc).

- **General over specific.** Reusable rule, not today’s incident.
- **Rewrite, don’t append.** Replace stale sections. Link `_docs/` for depth — don’t paste it here.
- **One job per file.** Root = repo-wide. App/package = that folder. One `.mdc` = one concern.
- **Locked decisions only.** Stack, phase, hard don’ts. Skip tutorials and chat recap.
- Split `apps/<app>/**` into `<app>-<concern>.mdc` only when the entry file mixes 2+ stable concerns **and** no longer fits one screen. Map: [`.cursor/rules/README.md`](.cursor/rules/README.md).

## Layout

```text
apps/api   → Nest API (source of truth)     @cabin/api
apps/pms   → Staff PMS UI (Phase 1 prod)    @cabin/pms
apps/web   → Public browse/book (Phase 2)   @cabin/web (Vite + prerender; stack locked)
packages/  → Shared libs for 2+ apps        @cabin/*
_docs/     → Product plan + locked design notes
```

One backend. Both frontends call `apps/api`. **pnpm only** from repo root (never `npm i` inside an app).

**Phase 1** = production **staff** PMS for live manual + OTA (calendar, reservations, money/DP, reports, iCal hub). **No OTA email ingest.** **Phase 2** = **customer** `web` book FE only — same `Reservation` + `domain/` (`source=WEBSITE`). Phase 2 is not “when bookings or payments start.” Design: [`_docs/reservations-design.md`](_docs/reservations-design.md).

**Deploy:** push `release` → GHCR → VPS pull + migrate. Compose, ports, HTTPS cutover: [`deploy/garage/README.md`](deploy/garage/README.md). Packages / Docker COPY: [`packages/README.md`](packages/README.md). Integrations (media, …): [`_docs/integrations-pattern.md`](_docs/integrations-pattern.md). IDE: open [`cabin.code-workspace`](cabin.code-workspace) (one folder) — [`.cursor/rules/monorepo-eslint-types.mdc`](.cursor/rules/monorepo-eslint-types.mdc).

## Locked stack (Phase 1)

| App | Stack | Status |
|-----|--------|--------|
| `api` | NestJS · TypeScript · PostgreSQL · Prisma 6 · session cookies + Guards | Staff auth, inventory, reservations/money live |
| `pms` | React · Vite · TypeScript · Tailwind v4 · shadcn/ui (radix-nova) · `:5173` | Staff desk on Nest |
| `web` | Same FE stack + `@cabin/ui-tokens` · i18n en/id/zh · `:5174` · prerender/SSG · CDN | Phase 2 scaffold; stack locked |

Do not introduce Express+Mongo, a second API, or a second booking database.

## Commands

From **repo root**: `pnpm install` · `pnpm typecheck` · `pnpm db:up` · `pnpm --filter @cabin/<app> dev`. Full script list: root `package.json`. One `.env` at repo root (`.env.example`).

## Product path

| Phase | Focus |
|-------|--------|
| **1 (now)** | Prod staff PMS: auth, units, calendar, reservations (total/paid/DP), check-in/out, reports, **iCal hub** (PMS export → each OTA; import each OTA → PMS). Mesh bootstrap OK until PMS trusted. **No email ingest.** |
| **2** | Customer `web` browse/book + public API — **same** reservation/money model |
| **3** | Paid Channel Manager only if iCal delay/scale hurts |

Hub topology + migration: [`_docs/reservations-design.md`](_docs/reservations-design.md) §9. `CONFIRMED` = ops-booked, **not** fully paid. iCal stubs → `UNCONFIRMED` until staff enrich guest + money. Money quote/cash: same doc §6.

## Navigation

| Work in | Read |
|---------|------|
| Repo / architecture | This file + `_docs/cabin-pms-client-plan.md` |
| Reservations / money / iCal | [`_docs/reservations-design.md`](_docs/reservations-design.md) |
| Calendar / dashboard / reports | [`_docs/calendar-design.md`](_docs/calendar-design.md) · [`_docs/dashboard-design.md`](_docs/dashboard-design.md) · [`_docs/reports-design.md`](_docs/reports-design.md) |
| Shared libs | `packages/README.md` + that package’s `AGENTS.md` |
| Media / archive / logs / backup | [`_docs/media-upload-strategy.md`](_docs/media-upload-strategy.md) · [`_docs/archive-storage.md`](_docs/archive-storage.md) · [`_docs/request-logs.md`](_docs/request-logs.md) · [`_docs/database-backup.md`](_docs/database-backup.md) |
| Backend / staff UI / public site | `apps/api/AGENTS.md` · `apps/pms/AGENTS.md` · `apps/web/AGENTS.md` + `apps/web/PRODUCT.md` |

Rules map: [`.cursor/rules/README.md`](.cursor/rules/README.md). Commits: [`.cursor/rules/commits.mdc`](.cursor/rules/commits.mdc). Tooling: [`.cursor/rules/monorepo-tooling.mdc`](.cursor/rules/monorepo-tooling.mdc).

## Hard don’ts

- Promise zero double-booking from iCal alone
- Remote OTA “Import now” bots / scraping
- Claim iCal syncs prices
- Rip OTA↔OTA mesh before PMS export is verified on all OTAs (`_docs/reservations-design.md` §9)
- Defer staff reservation **money/DP** until Phase 2 web
- OTA **email ingest** / ping / quick-confirm parsers — iCal + staff enrich
- Treat Phase 2 as a second booking/payment model — web reuses `domain/reservations`
- Default Phase 2 `web` to Next.js — Vite + prerender; Next only by explicit decision
- Channel Manager or `web` booking before Phase 1 ops MVP is solid
- Copy the same types/constants into two apps — use `packages/`
- Flat audience-neutral Nest routes (`/properties`, `/admins`) — `/staff/...` or `/public/...`

## Inventory

```text
property → unit_type (optional) → unit → reservations / blocks
```

One calendar per **unit**. Overlap safety is enforced in Postgres (not UI-only).

## Quality gates

`type(scope): summary` — scopes `api` | `pms` | `web` | `packages` | `repo` | `deps`. Husky: `pnpm typecheck` + commitlint. Do not `--no-verify` unless the user asks.
