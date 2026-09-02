# apps/api

NestJS backend (`@cabin/api`). **Source of truth** for units, reservations, availability, staff auth, and ops. Serves production **staff PMS** now (`pms`) and later **public web** (`/public` — Phase 2 customer FE only).

## Status

- Nest + **Prisma 6** + local Postgres (`pnpm db:up`)
- **Staff auth:** cookie sessions (`express-session` + `connect-pg-simple`), `Admin` model, roles below — `/staff/auth`
- **Staff CRUD:** SUPER_ADMIN-only list / create / change role / revoke-restore — `/staff/admins`
- **Inventory CRUD:** `Property` / `UnitType` / `Unit` — `/staff/properties|unit-types|units`; reads `FRONT_DESK+`; writes `ADMIN+`
- **Media upload-intent:** provider-agnostic intents via `integrations/media` (default Cloudinary; optional Cloudflare R2) — `GET /staff/media/config` + `POST /staff/media/upload-intent` (`ADMIN+`); Nest does not proxy file bytes; R2 images are FE-optimized before intent
- **Archive upload-intent:** parallel capability via `integrations/archive` (Garage) — `GET /staff/archive/config` + `POST /staff/archive/upload-intent` (`FRONT_DESK+`); inventory media unchanged; see [`_docs/archive-storage.md`](../../_docs/archive-storage.md)
- **Reservations + money:** Prisma `Reservation` / `PaymentMovement`; Nest `/staff/reservations` (list/create/detail/patch/confirm/check-in/out/cancel/movements) — `FRONT_DESK+`; `GET /staff/reservations/:id/utility-statement?chargeYearMonth=YYYY-MM` raw PDF (`FRONT_DESK+`; Gotenberg down → 503 `PDF_UNAVAILABLE`); list returns slim `StaffReservationListItem` (table fields); detail/mutations return full `StaffReservation` (+ movements on GET); list `sort?` = `checkIn` (default) | `createdAt` | `openAmount` (highest `max(Due, Refund)` first); optional stay-touch `from`/`to` (`to` optional when `from` set; with both: `checkInDate ≤ to AND checkOutDate ≥ from`; `from` only: `checkOutDate ≥ from`); optional `billingPeriod` exact filter; board `arrivals` = `CONFIRMED` + `checkInDate ≤ today < checkOutDate`; board `departures` = `CHECKED_IN` + `checkOutDate ≤ today` (both overdue inclusive); Paid = sum(movements); optional `proofImages` on movements (PATCH proofs replace-set); latest movement undo within 5 min; overlap exclusion + transactional 409
- **Availability:** `GET /staff/properties/:propertyId/units/availability` — all units (optional `unitTypeId`) with `available` + `blockReason`; dates optional (omit = no `DATE_OVERLAP`); optional `billingPeriod` (MONTHLY/YEARLY → proposed busy = FAR); optional `excludeReservationId` / `excludeBlockId` for edit
- **Unit occupancy (date picker):** `GET /staff/units/:id/occupancy?yearMonth=YYYY-MM` — occupying stays (busy end = `inventoryEndDate`) + calendar blocks for one month; optional `excludeReservationId` / `excludeBlockId` so edit pickers don’t paint the row being changed; FE caches months as the calendar pages
- **Bookability:** Property `isActive` (open for ops) · UnitType `isActive` (offered) · Unit `status` only (`ACTIVE` bookable; no separate unit `isActive`)
- **Inventory hold:** DAILY busy = `[checkIn, checkOut)`; MONTHLY/YEARLY occupying busy = `[checkIn, FAR)` until `CHECKED_OUT`/`CANCELLED` (`inventoryEndDate`; contract dates unchanged for money/boards/reports)
- **Property calendar:** `GET /staff/properties/:propertyId/calendar?from&to` — units + paint stays (`CALENDAR_PAINT_RESERVATION_STATUSES`: occupying + `CHECKED_OUT` history; bars span to `inventoryEndDate`) + `CalendarBlock` bars; block CRUD `/staff/calendar-blocks` (`FRONT_DESK+`); overlap still occupying + blocks only
- **Reports:** `GET /staff/reports/summary?propertyId&from&to&compare=` — cash (movements by property-TZ business date) · occupancy (clip nights, expand units) · source mix · equal-length compare (`ADMIN+`); wire `StaffReportsSummary`
- **Request logs:** `GET /staff/request-logs` — ADMIN+ Loki query (not Postgres); wire `StaffRequestLogsList`; newest 500 HTTP lines; Loki down → 503 `LOGS_UNAVAILABLE`
- **Dashboard:** `GET /staff/dashboard?propertyId&date?` — today arrivals/departures + needs attention (`FRONT_DESK+`); real board-predicate assemble (cap 8 + honest totals); wire `StaffDashboard`
- **iCal:** `Unit.icalExportToken` + `UnitIcalFeed`; hub topology (PMS export → OTAs; import each OTA → PMS) — [`_docs/reservations-design.md`](../../_docs/reservations-design.md) §9. Live `GET /public/ical/units/:unitId.ics?token=` (PMS origin proxy); cron + `POST /staff/ical/sync-all`; Accept dates / Accept unit / Dismiss on reservation detail.
- **Design (locked):** [`_docs/reservations-design.md`](../../_docs/reservations-design.md) — money axes, boards, Choose unit, Total = `periodCount ×` matching rack (`billingPeriod` + `defaultPriceIdr` / `monthlyPriceIdr` / `yearlyPriceIdr`; `suggestStayTotalIdr` in `@cabin/api-contract`); guest never arrived → Cancel (no `NO_SHOW` status)

## Stack (locked)

- NestJS + TypeScript
- PostgreSQL + Prisma 6
- Session cookies in Postgres + role Guards (`SUPER_ADMIN` | `ADMIN` | `FRONT_DESK`)
- Validation on DTOs; CORS allowlist for FE origins (`credentials: true`)
- Helmet + in-process `@nestjs/throttler` (see Security)

## Audience layout

One API, two HTTP audiences. Folders and URL prefixes must match.

```text
src/staff/     → PMS HTTP only (`/staff/...` + StaffSessionAuthGuard / StaffRoles)
src/domain/    → Shared services, input DTOs, mappers — no controllers
src/public/    → Web HTTP only (`/public/...`) — Phase 2 customer book; empty until then
src/common/    → Cross-cutting (http envelope, pagination base, staff mapper helpers)
```

| New feature | Put HTTP in | Put logic in |
|-------------|-------------|--------------|
| Staff-only (auth, admin users, ops settings) | `staff/<feature>/` | same folder OK |
| Shared with web later (inventory, availability, **reservations/money**) | `staff/<feature>/` now; `public/<feature>/` in Phase 2 | `domain/<feature>/` **from day one** |
| Web-only | `public/<feature>/` | `domain/` if reusable, else under `public/` |

Reservations, calendar, reports, iCal follow the same table — **not** a flat audience-neutral `/reservations` controller. Build reservation **schema + domain** for prod staff now (incl. payment summary); public book only adds HTTP later. **No email ingest module.**

Rule: [`.cursor/rules/api-audience.mdc`](../../.cursor/rules/api-audience.mdc).

## Roles

Hierarchy: `SUPER_ADMIN` > `ADMIN` > `FRONT_DESK`. `@StaffRoles(X)` means **X or higher**.

| Role | Intent |
|------|--------|
| `SUPER_ADMIN` | Manage staff + full system (seeded bootstrap account) |
| `ADMIN` | Modules / settings / ops — not admin-user CRUD |
| `FRONT_DESK` | Daily ops only (matrix later) |

Examples: `@StaffRoles('ADMIN')` → ADMIN + SUPER_ADMIN · `@StaffRoles('FRONT_DESK')` → all staff · `@StaffRoles('SUPER_ADMIN')` → SUPER_ADMIN only.

## Staff auth endpoints

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/staff/auth/login` | `{ username, password }` → session cookie |
| `POST` | `/staff/auth/logout` | Destroy session (authenticated) |
| `GET` | `/staff/auth/session` | Current admin from cookie (all fields except password) |
| `PATCH` | `/staff/auth/username` | `{ username, currentPassword }` → `StaffAdmin` (authenticated) |
| `PATCH` | `/staff/auth/password` | `{ currentPassword, newPassword }` → `{ ok: true }` (authenticated) |

Username: min 3 / max 64, charset `a-zA-Z0-9._-`. Password: min 8 / max 128. Domain field errors use `details: { field, reason }` (`USERNAME_TAKEN`, `INVALID_CURRENT_PASSWORD`, `SAME_AS_CURRENT`, `USERNAME_UNCHANGED`). Limits: `@cabin/api-contract`.

Cookie name: `cabin.pms.sid` (httpOnly). Logout clears the cookie. Env: `SESSION_SECRET`, `CORS_ORIGINS` (required in production), seed vars below. Production enables Express `trust proxy` for secure cookies behind TLS termination.

## Staff admin endpoints (SUPER_ADMIN only)

All require session + `@StaffRoles('SUPER_ADMIN')`. Mutates require the actor’s `currentPassword` (same field-error pattern as change username). Soft revoke via `isActive`.

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/staff/admins` | All admins including self (`StaffAdmin[]`, no pagination) |
| `POST` | `/staff/admins` | `{ username, password, role, currentPassword }` → create |
| `PATCH` | `/staff/admins/:id/role` | `{ role, currentPassword }` — not self; not last active SUPER_ADMIN demote |
| `PATCH` | `/staff/admins/:id/active` | `{ isActive, currentPassword }` — not self-revoke; not last active SUPER_ADMIN revoke |

## Inventory endpoints (session required)

Reads: `@StaffRoles('FRONT_DESK')`. Writes (POST/PATCH/DELETE): `@StaffRoles('ADMIN')`.

List `data` shape: `{ items, pageInfo: { page, pageSize, total, totalPages } }` (`Paginated<T>` in `@cabin/api-contract`). Query: `page`, `pageSize` (default 20, max 100), `q?`, plus filters below.

Wire types: `StaffProperty` / `StaffUnitType` / `StaffUnit` (staff/PMS shapes — not the public website catalog).

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/staff/properties` | Paginated; `isActive?`, `q?`. Full row + `typeCount` / `unitCount` |
| `GET` | `/staff/properties/options` | All properties as `{ id, name }[]` (filter/select; unpaginated) |
| `GET` | `/staff/properties/:id` | Full property + counts |
| `POST` | `/staff/properties` | Create |
| `PATCH` | `/staff/properties/:id` | Update |
| `DELETE` | `/staff/properties/:id` | 409 `HAS_CHILDREN` if any unit types or units (service + FK Restrict) |
| `GET` | `/staff/properties/:propertyId/unit-types` | Paginated; `isActive?`, `q?`. Full row + `unitCount` |
| `POST` | `/staff/properties/:propertyId/unit-types` | Create; `bedroomCount` derived; `sortOrder` server-assigned |
| `GET` | `/staff/unit-types/:id/rack` | Rack rates (`defaultPriceIdr` / `monthlyPriceIdr` / `yearlyPriceIdr`) — stay Total suggestion |
| `GET` | `/staff/unit-types/:id` | Full unit type + `unitCount` |
| `PATCH` | `/staff/unit-types/:id` | Update |
| `DELETE` | `/staff/unit-types/:id` | 409 if any units |
| `GET` | `/staff/properties/:propertyId/units` | Paginated; `unitTypeId?`, `status?`, `isActive?`, `q?` |
| `POST` | `/staff/properties/:propertyId/units` | Body includes `unitTypeId` (must belong to property) |
| `GET` | `/staff/units/:id` | Full unit |
| `PATCH` | `/staff/units/:id` | Update (`propertyId` / `unitTypeId` immutable) |
| `DELETE` | `/staff/units/:id` | Hard delete (Restrict backstop when reservations exist later) |

Media: jsonb `MediaItem` (`coverImage` / `media[]`); `url` is an HTTPS CDN/object URL — API does not upload or serve bytes. Upload: `GET /staff/media/config` → `{ provider }` then `POST /staff/media/upload-intent` (`ADMIN+`) returns provider-discriminated `MediaUploadIntent` (`MediaProvider`: `cloudinary` | `cloudflare_r2`); browser uploads directly. Adapters: `src/integrations/media/`. R2 images: PMS compresses before intent (no CF Image Transformations). Bounds: `MEDIA_*` in `@cabin/api-contract`. Env: `MEDIA_PROVIDER` (default `cloudinary`) + vendor vars (`CLOUDINARY_*` or `CLOUDFLARE_*` / `MEDIA_PUBLIC_BASE_URL`) in root `.env` only. See [`_docs/media-upload-strategy.md`](../../_docs/media-upload-strategy.md) · [`_docs/integrations-pattern.md`](../../_docs/integrations-pattern.md). Field reasons: `CODE_TAKEN`, `HAS_CHILDREN`, `LAT_LNG_PAIR_REQUIRED`, `UNIT_TYPE_INVALID` (+ lat/lng range via DTO).

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/staff/media/config` | `{ provider }` — FE decides R2 image optimize |
| `POST` | `/staff/media/upload-intent` | `{ kind, mimeType, byteSize, name? }` → provider-shaped `MediaUploadIntent` |
| `GET` | `/staff/archive/config` | `{ provider }` — Garage archive proofs (parallel to media) |
| `POST` | `/staff/archive/upload-intent` | `{ kind, mimeType, byteSize, name? }` → `ArchiveUploadIntent` |

Seed: Skybreeze Sentraland (1 property, **9 unit types**, **60 units**) + bootstrap `SUPER_ADMIN`. Fresh DB: `SEED_DEMO_INVENTORY=1 pnpm --filter @cabin/api prisma:seed` (placeholder rack rates + default min kWh / admin fee / add-on scheme). Existing DB with `SEED_DEMO_INVENTORY=1`: `ensureSkybreezeUtilityDefaults` appends add-ons and fills min kWh / admin fee only when those are still unset — **never** overwrites live `electricityRateIdrPerKwh` / `waterRateIdrPerM3` / `maintenanceFeeIdrPerMonth`. Replace inventory on existing DB: `pnpm --filter @cabin/api import:sentraland-inventory` (destructive — wipes Skybreeze units/types and their reservations/blocks first). Preview: `DRY_RUN=1 pnpm --filter @cabin/api import:sentraland-inventory`.

## HTTP contract

Controllers return **domain objects only**. Global `TransformInterceptor` + `HttpExceptionFilter` own the wire shape. Request diary is JSON (`nestjs-pino`); Nest pushes HTTP lines to Loki; search via `GET /staff/request-logs` (ADMIN+) → Loki ([`_docs/request-logs.md`](../../_docs/request-logs.md)).

**Success (2xx):** `{ data: T, meta?: { requestId } }` — header `x-request-id` mirrors `meta.requestId`.

**Error (4xx/5xx):** `{ error: { code, message, details? }, meta?: { requestId } }`

| HTTP | `error.code` |
|------|----------------|
| 400 | `VALIDATION_FAILED` or `BAD_REQUEST` |
| 401 | `AUTH_UNAUTHORIZED` |
| 403 | `AUTH_FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` |
| 503 | `LOGS_UNAVAILABLE` (Loki down), `PDF_UNAVAILABLE` (Gotenberg down), or `INTERNAL_ERROR` |

FE: `credentials: 'include'`; unwrap `data`; never parse Nest’s default error shape. Shared setup: `setupHttpContract()` in `src/common/http/`.

**Domain field errors (form highlight):** when a write fails on a **user-editable** input, return `details: { field, reason }` (`ApiFieldReason` in `@cabin/api-contract`). PMS maps those via `applyApiFieldError` → RHF `setError`. Use for uniqueness (`CODE_TAKEN`), lat/lng pair (`LAT_LNG_PAIR_REQUIRED` on the missing field), invalid `unitTypeId`, staff credential field errors. Do **not** use for 404, auth, 429 `RATE_LIMITED`, or delete-blocked (`HAS_CHILDREN` → dialog/toast). Rule: [`.cursor/rules/api-http.mdc`](../../.cursor/rules/api-http.mdc).

Cross-app wire types: import from `@cabin/api-contract` — envelope, codes, `Staff*` types, `Paginated` / `PageInfo`. Do not redefine those here.

## Run

```bash
pnpm db:up
pnpm prisma:generate
pnpm --filter @cabin/api prisma:migrate
pnpm --filter @cabin/api prisma:seed
pnpm --filter @cabin/api dev
pnpm --filter @cabin/api typecheck
pnpm --filter @cabin/api lint
pnpm --filter @cabin/api test
```

IDE must match CLI (`pnpm --filter @cabin/api lint`). Open [`cabin.code-workspace`](../../cabin.code-workspace). See [`.cursor/rules/monorepo-tooling.mdc`](../../.cursor/rules/monorepo-tooling.mdc).

`GET /health` → `{ data: { status: "ok", database: "up" }, meta: { requestId } }` (infra; outside audience trees).

Env: **one** file — repo root `.env`. Schema: `apps/api/prisma/schema.prisma`. Client: `apps/api/src/generated/prisma` (gitignored).

Seed: `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` (defaults in `.env.example`) + Skybreeze Sentraland inventory manifest (`src/scripts/sentraland-inventory.ts`). Existing DB inventory replace: `import:sentraland-inventory` (not plain `prisma:seed`).

## Security

**Phase 1 (staff PMS prod):** CORS allowlist, sessions + Guards, Helmet, in-process `@nestjs/throttler` (no Redis, no account lockout).

Helmet (JSON API): CSP off; `Cross-Origin-Resource-Policy: cross-origin`; HSTS only when `COOKIE_SECURE=true` (HTTP VPS must not pin HSTS).

Throttler is a global `APP_GUARD` (`CabinThrottlerGuard`). Limits live in `src/common/http/throttler/throttler.limits.ts`. **New HTTP:** classify the handler — [`.cursor/rules/api-throttle.mdc`](../../.cursor/rules/api-throttle.mdc).

| Bucket | Routes | Tracker | Limit |
|--------|--------|---------|-------|
| Skip | `GET /health` | — | none (Compose healthcheck) |
| `auth` | login, username/password, admin create/role/active | IP | 20 / 15 min |
| `authUser` | `POST /staff/auth/login` only | username (lowercased) | 20 / 15 min |
| `ical` | `GET /public/ical/...` (OTA export poll) | IP | 1200 / min |
| `default` | all other routes | session `adminId` or IP | 120 / min per handler |
| `global` | same as `default` (not iCal) | IP | 300 / min across routes |

Public iCal is **not** on `default`/`global` — a 300-unit Booking/Airbnb poll from one crawler IP would 429 at 120/300. Token is still the lock; `ical` only caps scrapers. Staff `POST /staff/ical/sync-all` is one desk call (we fetch OTA URLs outbound) — stays on `default`. Credential 429 is generic — no remaining count, no `Retry-After`. Envelope: `RATE_LIMITED`.

**Phase 2 (public `web`):** same throttler floor on `/public`. Arcjet is optional later (API only — never the FE). Public origin sits behind Cloudflare; never cache `/api/`.

## Phase 1 build order

1. Staff auth + roles ← **done** (auth + SUPER_ADMIN staff CRUD)
2. Inventory CRUD (property / unit type / unit) ← **done**
3. Reservations CRUD + money/DP + availability (overlap in DB) ← **done** (`/staff/reservations` + units availability)
4. Check-in / check-out ← **done** (with `confirmEarly`)
5. Basic reports ← **done** (`GET /staff/reports/summary`)
6. iCal export + import + Sync all ← **done** (`/public/ical` · `/staff/ical/sync-all` · Accept/Dismiss)

Reservation `source`: `manual` | `website` (enum now, public write in Phase 2) | `booking_com` | `airbnb` | `agoda`  
Ops `status` ≠ money: `CONFIRMED` is not “paid”. Money: `totalAmountIdr` (quote) + append-only `PaymentMovement` cash lines (grace undo of the latest row within 5 min); `paidAmountIdr` = sum(movements); `paymentStatus` (`UNPAID` | `DEPOSIT` | `PAID` | `REFUNDED`). Nest must append movements — do not overwrite Paid alone. Optional `proofImages` on a line are a replace-set (`PATCH .../movements/:id/proofs`) — not a money edit. Cancel partial takes `refundAmountIdr` (money OUT), not remaining Paid. Stamp session `createdByAdminId` / `updatedByAdminId` on reservation + movement create (not a full audit log).  
Statuses: `UNCONFIRMED` | `CONFIRMED` | `CHECKED_IN` | `CHECKED_OUT` | `CANCELLED` — **no** `NO_SHOW` / `DRAFT` / email ingest (never-arrived → Cancel).

## Domain model

```text
property → unit_type (optional) → unit → reservations / blocks
```

One calendar per unit. Occupying stays and calendar blocks must not overlap on the same unit (Postgres exclusion / transactional write).

## Code conventions

- Controllers live only under `staff/` or `public/`. `@Controller` paths include `staff/` or `public/` (except `/health`).
- Input DTOs for shared inventory live under `domain/<feature>/dto` (services already depend on them).
- DTOs with `class-validator` (+ `ValidationPipe`). No bare `any` on controllers.
- Prisma only inside services — not controllers.
- Use `StaffSessionAuthGuard` + `@StaffRoles(...)` / `StaffRolesGuard` on all `/staff/*` routes (`@StaffRoles` is minimum-role, not an exact allowlist).

## Don’t

- Scrape OTAs or remote “Import now”
- Second database for bookings
- Trust UI-only overlap checks
- Defer reservation money/DP to Phase 2 — staff PMS needs it for live walk-in/OTA ops
- OTA email ingest / parsers — out of scope; iCal + staff enrich
- Channel Manager in Phase 1
- Mix guest `User` with `Admin` (guest identity is Phase 2 web)
- Put Arcjet (or API secrets) in the frontend
- Audience-neutral app API paths (`/properties`, `/admins`) — use `/staff/...` or `/public/...`
- Controllers (or guards) under `domain/`
- Unguard `/staff/*` for the website — add a `public/` controller that calls `domain/` instead
- Reuse `Staff*` wire types as the public catalog contract without a deliberate public DTO

Root: `AGENTS.md` · Plan: `_docs/cabin-pms-client-plan.md` · Reservations: `_docs/reservations-design.md`
