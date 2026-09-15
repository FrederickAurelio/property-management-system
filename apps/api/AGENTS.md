# apps/api

NestJS backend (`@cabin/api`). Source of truth for units, reservations, availability, staff auth, and ops. Serves **staff PMS** now (`/staff`) and later **public web** (`/public` — Phase 2 customer book only).

## Status

Phase 1 staff HTTP is live: auth, admins, inventory, media/archive upload-intents, reservations + money, availability/occupancy, calendar blocks, reports, expenses, dashboard, request logs (Loki), iCal hub.

**Routes live in the controllers** (`src/staff/`, `src/public/`). Domain + money + boards + iCal: [`_docs/reservations-design.md`](../../_docs/reservations-design.md). Also [`_docs/calendar-design.md`](../../_docs/calendar-design.md) · [`_docs/reports-design.md`](../../_docs/reports-design.md) · [`_docs/dashboard-design.md`](../../_docs/dashboard-design.md) · [`_docs/media-upload-strategy.md`](../../_docs/media-upload-strategy.md) · [`_docs/archive-storage.md`](../../_docs/archive-storage.md) · [`_docs/request-logs.md`](../../_docs/request-logs.md). Wire types: `@cabin/api-contract`.

## Stack (locked)

- NestJS + TypeScript + PostgreSQL + Prisma 6
- Session cookies in Postgres + role Guards (`SUPER_ADMIN` | `ADMIN` | `FRONT_DESK`)
- DTO `ValidationPipe`; CORS allowlist (`credentials: true`); Helmet; in-process `@nestjs/throttler` (no Redis, no account lockout)

## Audience layout

Folders and URL prefixes must match. Rule: [`.cursor/rules/api-audience.mdc`](../../.cursor/rules/api-audience.mdc).

```text
src/staff/     → PMS HTTP only (`/staff/...` + StaffSessionAuthGuard / StaffRoles)
src/domain/    → Shared services, input DTOs, mappers — no controllers
src/public/    → Web HTTP only (`/public/...`) — Phase 2 customer book
src/common/    → Cross-cutting (http envelope, pagination, staff mapper helpers)
```

| New feature | Put HTTP in | Put logic in |
|-------------|-------------|--------------|
| Staff-only (auth, admin users, ops settings) | `staff/<feature>/` | same folder OK |
| Shared with web later (inventory, availability, **reservations/money**) | `staff/<feature>/` now; `public/<feature>/` in Phase 2 | `domain/<feature>/` **from day one** |
| Web-only | `public/<feature>/` | `domain/` if reusable, else under `public/` |

No audience-neutral `/reservations` controller. **No email ingest module.**

## Roles

`SUPER_ADMIN` > `ADMIN` > `FRONT_DESK`. `@StaffRoles(X)` means **X or higher**. Auth: [`.cursor/rules/api-auth.mdc`](../../.cursor/rules/api-auth.mdc).

| Role | Intent |
|------|--------|
| `SUPER_ADMIN` | Manage staff + full system (seeded bootstrap account) |
| `ADMIN` | Modules / settings / ops — not admin-user CRUD |
| `FRONT_DESK` | Daily ops only |

Cookie: `cabin.pms.sid` (httpOnly). Production: Express `trust proxy` for secure cookies behind TLS. Env: `SESSION_SECRET`, `CORS_ORIGINS` (required in production).

## HTTP contract

Controllers return **domain objects only**. Envelope: `setupHttpContract()` in `src/common/http/`. Field errors: [`.cursor/rules/api-http.mdc`](../../.cursor/rules/api-http.mdc). Wire: `@cabin/api-contract` — do not redefine envelope/codes/`Staff*`/`Paginated` here.

**Success (2xx):** `{ data: T, meta?: { requestId } }` · header `x-request-id`.  
**Error:** `{ error: { code, message, details? }, meta?: { requestId } }`

| HTTP | `error.code` |
|------|----------------|
| 400 | `VALIDATION_FAILED` or `BAD_REQUEST` |
| 401 / 403 | `AUTH_UNAUTHORIZED` / `AUTH_FORBIDDEN` |
| 404 / 409 / 429 | `NOT_FOUND` / `CONFLICT` / `RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` |
| 503 | `LOGS_UNAVAILABLE` (Loki) · `PDF_UNAVAILABLE` (Gotenberg) |

`GET /health` is infra (outside audience trees). List `data` is `Paginated<T>`. Filters in Prisma `where`: [`.cursor/rules/api-prisma.mdc`](../../.cursor/rules/api-prisma.mdc).

## Run

```bash
pnpm db:up
pnpm prisma:generate
pnpm --filter @cabin/api prisma:migrate
pnpm --filter @cabin/api prisma:seed
pnpm --filter @cabin/api dev
```

One env file: repo root `.env`. Schema: `apps/api/prisma/schema.prisma`. Client: `apps/api/src/generated/prisma` (gitignored). IDE must match `pnpm --filter @cabin/api lint` — [`cabin.code-workspace`](../../cabin.code-workspace).

Seed: `SEED_ADMIN_*` + Skybreeze manifest (`src/scripts/sentraland-inventory.ts`). `SEED_DEMO_INVENTORY=1` on an **existing** DB must **never** overwrite live `electricityRateIdrPerKwh` / `waterRateIdrPerM3` / `maintenanceFeeIdrPerMonth`. Replace inventory: `pnpm --filter @cabin/api import:sentraland-inventory` (`DRY_RUN=1` to preview).

## Security

CORS allowlist, sessions + Guards, Helmet, in-process throttler. Helmet (JSON API): CSP off; `Cross-Origin-Resource-Policy: cross-origin`; HSTS only when `COOKIE_SECURE=true`.

Classify **new HTTP** into a throttler bucket: [`.cursor/rules/api-throttle.mdc`](../../.cursor/rules/api-throttle.mdc). Limits: `src/common/http/throttler/throttler.limits.ts`. Public iCal stays on `ical`, not `default`/`global`. Arcjet is optional later (**API only** — never the FE). Never cache `/api/` at the public CDN.

## Domain

```text
property → unit_type (optional) → unit → reservations / blocks
```

One calendar per unit. Occupying stays and calendar blocks must not overlap (Postgres exclusion / transactional write).

- **Bookability:** Property `isActive` · UnitType `isActive` · Unit `status` `ACTIVE` only (no unit `isActive`).
- **Hold:** DAILY busy `[checkIn, checkOut)`; MONTHLY/YEARLY occupying `[checkIn, FAR)` until `CHECKED_OUT`/`CANCELLED` (`inventoryEndDate`; contract dates unchanged for money/boards/reports).
- **Money ≠ ops:** `CONFIRMED` is not paid. Quote `totalAmountIdr`; cash = `PaymentMovement` (append-only except latest undo within 5 min; Collect IN uncapped); Paid = sum. Never overwrite Paid alone. Guest never arrived → Cancel. Full axes: [`_docs/reservations-design.md`](../../_docs/reservations-design.md) §6.
- **Status:** `UNCONFIRMED` \| `CONFIRMED` \| `CHECKED_IN` \| `CHECKED_OUT` \| `CANCELLED` — no `NO_SHOW` / `DRAFT`.
- **Source:** `manual` \| `website` (public write in Phase 2) \| `booking_com` \| `airbnb` \| `agoda`.
- **iCal** updates PMS only — does not refresh OTAs. Hub: reservations-design §9.

Media/archive: Nest mints upload-intents; it does not proxy file bytes (`src/integrations/`).

## Code conventions

- Controllers only under `staff/` or `public/`. `@Controller` paths include `staff/` or `public/` (except `/health`).
- Shared-feature input DTOs under `domain/<feature>/dto`.
- DTOs with `class-validator`. No bare `any` on controllers.
- Prisma only inside services.
- `StaffSessionAuthGuard` + `@StaffRoles(...)` / `StaffRolesGuard` on all `/staff/*`.

## Don’t

- Scrape OTAs or remote “Import now”
- Second database for bookings
- Trust UI-only overlap checks
- Defer reservation money/DP to Phase 2
- OTA email ingest / parsers
- Channel Manager in Phase 1
- Mix guest `User` with `Admin`
- Put Arcjet (or API secrets) in the frontend
- Audience-neutral app paths (`/properties`, `/admins`)
- Controllers or guards under `domain/`
- Unguard `/staff/*` for the website — add a `public/` controller that calls `domain/`
- Reuse `Staff*` wire types as the public catalog without a deliberate public DTO

Root: `AGENTS.md` · Plan: `_docs/cabin-pms-client-plan.md`
