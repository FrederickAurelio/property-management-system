# apps/api

NestJS backend (`@cabin/api`). **Source of truth** for units, reservations, availability, staff auth, and ops. Serves `pms` (Phase 1) and `web` (Phase 2).

## Status

- Nest + **Prisma 6** + local Postgres (`pnpm db:up`)
- **Staff auth:** cookie sessions (`express-session` + `connect-pg-simple`), `Admin` model, roles below — `/staff/auth`
- **Staff CRUD:** SUPER_ADMIN-only list / create / change role / revoke-restore — `/staff/admins`
- **Inventory CRUD:** `Property` / `UnitType` / `Unit` (15 endpoints) — `/staff/properties|unit-types|units`; reads `FRONT_DESK+`; writes `ADMIN+`
- **Media upload-intent:** Cloudinary signed params — `POST /staff/media/upload-intent` (`ADMIN+`); Nest does not proxy file bytes
- **Not yet:** reservations / calendar / permission matrix; public/web HTTP (`src/public/` scaffold only)

## Stack (locked)

- NestJS + TypeScript
- PostgreSQL + Prisma 6
- Session cookies in Postgres + role Guards (`SUPER_ADMIN` | `ADMIN` | `FRONT_DESK`)
- Validation on DTOs; CORS allowlist for FE origins (`credentials: true`)

## Audience layout

One API, two HTTP audiences. Folders and URL prefixes must match.

```text
src/staff/     → PMS HTTP only (`/staff/...` + StaffSessionAuthGuard / StaffRoles)
src/domain/    → Shared services, input DTOs, mappers — no controllers
src/public/    → Web HTTP only (`/public/...`) — Phase 2; empty module until then
src/common/    → Cross-cutting (http envelope, pagination base, staff mapper helpers)
```

| New feature | Put HTTP in | Put logic in |
|-------------|-------------|--------------|
| Staff-only (auth, admin users, ops settings) | `staff/<feature>/` | same folder OK |
| Shared later with web (inventory, availability, bookings core) | `staff/<feature>/` now; `public/<feature>/` when needed | `domain/<feature>/` |
| Web-only | `public/<feature>/` | `domain/` if reusable, else under `public/` |

Future modules (reservations, calendar, reports, ingest, ical) follow the same table — **not** a flat `src/reservations` with an audience-neutral `/reservations` controller.

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
| `GET` | `/staff/properties/:id` | Full property + counts |
| `POST` | `/staff/properties` | Create |
| `PATCH` | `/staff/properties/:id` | Update |
| `DELETE` | `/staff/properties/:id` | 409 `HAS_CHILDREN` if any unit types or units (service + FK Restrict) |
| `GET` | `/staff/properties/:propertyId/unit-types` | Paginated; `isActive?`, `q?`. Full row + `unitCount` |
| `POST` | `/staff/properties/:propertyId/unit-types` | Create; `bedroomCount` derived; `sortOrder` server-assigned |
| `GET` | `/staff/unit-types/:id` | Full unit type + `unitCount` |
| `PATCH` | `/staff/unit-types/:id` | Update |
| `DELETE` | `/staff/unit-types/:id` | 409 if any units |
| `GET` | `/staff/properties/:propertyId/units` | Paginated; `unitTypeId?`, `status?`, `isActive?`, `q?` |
| `POST` | `/staff/properties/:propertyId/units` | Body includes `unitTypeId` (must belong to property) |
| `GET` | `/staff/units/:id` | Full unit |
| `PATCH` | `/staff/units/:id` | Update (`propertyId` / `unitTypeId` immutable) |
| `DELETE` | `/staff/units/:id` | Hard delete (Restrict backstop when reservations exist later) |

Media: jsonb `MediaItem` (`coverImage` / `media[]`); `url` is a Cloudinary CDN link — API does not upload or serve bytes. Upload: `POST /staff/media/upload-intent` (`ADMIN+`) returns signed Cloudinary params (`MediaUploadIntent`); browser uploads directly. Bounds: `MEDIA_*` in `@cabin/api-contract`. Env: `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` (root `.env` only). Field reasons: `CODE_TAKEN`, `HAS_CHILDREN`, `LAT_LNG_PAIR_REQUIRED`, `UNIT_TYPE_INVALID` (+ lat/lng range via DTO).

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/staff/media/upload-intent` | `{ kind, mimeType, byteSize, name? }` → signed Cloudinary upload params |

Seed: Skybreeze Sentraland (1 property, 5 types, 8 units) + bootstrap `SUPER_ADMIN`.

## HTTP contract

Controllers return **domain objects only**. Global `TransformInterceptor` + `HttpExceptionFilter` own the wire shape.

**Success (2xx):** `{ data: T, meta?: { requestId } }` — header `x-request-id` mirrors `meta.requestId`.

**Error (4xx/5xx):** `{ error: { code, message, details? }, meta?: { requestId } }`

| HTTP | `error.code` |
|------|----------------|
| 400 | `VALIDATION_FAILED` or `BAD_REQUEST` |
| 401 | `AUTH_UNAUTHORIZED` |
| 403 | `AUTH_FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 500 | `INTERNAL_ERROR` |

FE: `credentials: 'include'`; unwrap `data`; never parse Nest’s default error shape. Shared setup: `setupHttpContract()` in `src/common/http/`.

**Domain field errors (form highlight):** when a write fails on a **user-editable** input, return `details: { field, reason }` (`ApiFieldReason` in `@cabin/api-contract`). PMS maps those via `applyApiFieldError` → RHF `setError`. Use for uniqueness (`CODE_TAKEN`), lat/lng pair (`LAT_LNG_PAIR_REQUIRED` on the missing field), invalid `unitTypeId`, staff credential field errors. Do **not** use for 404, auth, or delete-blocked (`HAS_CHILDREN` → dialog/toast). Rule: [`.cursor/rules/api-http.mdc`](../../.cursor/rules/api-http.mdc).

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

Seed: `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` (defaults in `.env.example`) + Skybreeze inventory (idempotent by property code).

## Security

**Phase 1 (staff PMS):** CORS allowlist, sessions + Guards. Add helmet + login rate-limit soon.

**Later (public `web`):** [Arcjet](https://docs.arcjet.com) on the **API only**.

## Phase 1 build order

1. Staff auth + roles ← **done** (auth + SUPER_ADMIN staff CRUD)
2. Inventory CRUD (property / unit type / unit) ← **done**
3. Reservations CRUD + availability (overlap enforced in DB)
4. Check-in / check-out
5. Basic reports
6. Email ingest → draft → notify → confirm
7. iCal import + Sync now

Reservation `source`: `manual` | `website` | `booking_com` | `airbnb` | `agoda`

## Domain model

```text
property → unit_type (optional) → unit → reservations / blocks
```

One calendar per unit. Confirmed stays must not overlap on the same unit (Postgres exclusion / transactional write).

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
- Channel Manager in Phase 1
- Mix guest `User` with `Admin` (guests are Phase 2)
- Put Arcjet (or API secrets) in the frontend
- Audience-neutral app API paths (`/properties`, `/admins`) — use `/staff/...` or `/public/...`
- Controllers (or guards) under `domain/`
- Unguard `/staff/*` for the website — add a `public/` controller that calls `domain/` instead
- Reuse `Staff*` wire types as the public catalog contract without a deliberate public DTO

Root: `AGENTS.md` · Plan: `.docs/cabin-pms-client-plan.md`
