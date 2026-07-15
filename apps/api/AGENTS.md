# apps/api

NestJS backend (`@cabin/api`). **Source of truth** for units, reservations, availability, staff auth, and ops. Serves `pms` (Phase 1) and `web` (Phase 2).

## Status

- Nest + **Prisma 6** wired (`PrismaModule` / `PrismaService`)
- Local Postgres via root Compose (`pnpm db:up`)
- **Not yet:** domain models, auth, feature modules

## Stack (locked)

- NestJS + TypeScript
- PostgreSQL + Prisma 6
- Session cookies + role Guards (`admin` | `front_desk`)
- Validation on DTOs; CORS allowlist for FE origins

## Run

```bash
pnpm db:up
pnpm prisma:generate
pnpm --filter @cabin/api prisma:migrate   # after first models exist
pnpm --filter @cabin/api dev
pnpm --filter @cabin/api typecheck
pnpm --filter @cabin/api test
```

`GET /health` — Nest + Postgres (`SELECT 1`).

Env: **one** file — repo root `.env` (Compose + `DATABASE_URL`). Schema: `apps/api/prisma/schema.prisma`. Client output: `apps/api/src/generated/prisma` (gitignored; `pnpm prisma:generate`).

## Security

**Phase 1 (staff PMS):** Nest built-ins first — `helmet`, CORS allowlist, login rate-limit, sessions + Guards.

**Later (public `web`):** [Arcjet](https://docs.arcjet.com) (`@arcjet/nest`) on the **API only**. Does not replace auth, Prisma overlap rules, or DTO validation.

## Phase 1 build order

1. Auth + roles
2. Units CRUD
3. Reservations CRUD + availability (overlap enforced in DB)
4. Check-in / check-out
5. Basic reports
6. Email ingest → draft → notify → confirm
7. iCal import + Sync now

Reservation `source`: `manual` | `website` | `booking_com` | `airbnb` | `agoda`

## Domain

```text
property → unit_type (optional) → unit → reservations / blocks
```

One calendar per unit. Confirmed stays must not overlap on the same unit (Postgres exclusion / transactional write).

## Module shape

Prefer Nest feature modules: `auth`, `units`, `reservations`, `ops`, later `ingest`, `ical`.

## Code conventions

- DTOs with `class-validator` (+ `ValidationPipe`). No bare `any` on controllers.
- Prisma only inside services — not controllers.

## Don’t

- Scrape OTAs or remote “Import now”
- Second database for bookings
- Trust UI-only overlap checks
- Channel Manager in Phase 1
- Put Arcjet (or API secrets) in the frontend

Root: `AGENTS.md` · Plan: `.docs/cabin-pms-client-plan.md`
