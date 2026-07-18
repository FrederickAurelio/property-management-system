# apps/api

NestJS backend (`@cabin/api`). **Source of truth** for units, reservations, availability, staff auth, and ops. Serves `pms` (Phase 1) and `web` (Phase 2).

## Status

- Nest + **Prisma 6** + local Postgres (`pnpm db:up`)
- **Staff auth:** cookie sessions (`express-session` + `connect-pg-simple`), `Admin` model, roles below
- **Staff CRUD (`admins`):** SUPER_ADMIN-only list / create / change role / revoke-restore
- **Inventory CRUD:** `Property` / `UnitType` / `Unit` (15 endpoints) — session; reads `FRONT_DESK+`; writes `ADMIN+`
- **Not yet:** reservations / calendar / permission matrix

## Stack (locked)

- NestJS + TypeScript
- PostgreSQL + Prisma 6
- Session cookies in Postgres + role Guards (`SUPER_ADMIN` | `ADMIN` | `FRONT_DESK`)
- Validation on DTOs; CORS allowlist for FE origins (`credentials: true`)

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
| `PATCH` | `/staff/auth/username` | `{ username, currentPassword }` → `PublicAdmin` (authenticated) |
| `PATCH` | `/staff/auth/password` | `{ currentPassword, newPassword }` → `{ ok: true }` (authenticated) |

Username: min 3 / max 64, charset `a-zA-Z0-9._-`. Password: min 8 / max 128. Domain field errors use `details: { field, reason }` (`USERNAME_TAKEN`, `INVALID_CURRENT_PASSWORD`, `SAME_AS_CURRENT`, `USERNAME_UNCHANGED`). Limits: `@cabin/api-contract`.

Cookie name: `cabin.pms.sid` (httpOnly). Logout clears the cookie. Env: `SESSION_SECRET`, `CORS_ORIGINS` (required in production), seed vars below. Production enables Express `trust proxy` for secure cookies behind TLS termination.

## Staff admin endpoints (SUPER_ADMIN only)

All require session + `@StaffRoles('SUPER_ADMIN')`. Mutates require the actor’s `currentPassword` (same field-error pattern as change username). Soft revoke via `isActive`.

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/admins` | All admins including self (`PublicAdmin[]`, no pagination) |
| `POST` | `/admins` | `{ username, password, role, currentPassword }` → create |
| `PATCH` | `/admins/:id/role` | `{ role, currentPassword }` — not self; not last active SUPER_ADMIN demote |
| `PATCH` | `/admins/:id/active` | `{ isActive, currentPassword }` — not self-revoke; not last active SUPER_ADMIN revoke |

## Inventory endpoints (session required)

Reads: `@StaffRoles('FRONT_DESK')`. Writes (POST/PATCH/DELETE): `@StaffRoles('ADMIN')`.

List `data` shape: `{ items, pageInfo: { page, pageSize, total, totalPages } }` (`Paginated<T>` in `@cabin/api-contract`). Query: `page`, `pageSize` (default 20, max 100), `q?`, plus filters below.

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/properties` | Paginated; `isActive?`, `q?`. Full row + `typeCount` / `unitCount` |
| `GET` | `/properties/:id` | Full property + counts |
| `POST` | `/properties` | Create |
| `PATCH` | `/properties/:id` | Update |
| `DELETE` | `/properties/:id` | 409 `HAS_CHILDREN` if any unit types or units (service + FK Restrict) |
| `GET` | `/properties/:propertyId/unit-types` | Paginated; `isActive?`, `q?`. Full row + `unitCount` |
| `POST` | `/properties/:propertyId/unit-types` | Create; `bedroomCount` derived; `sortOrder` server-assigned |
| `GET` | `/unit-types/:id` | Full unit type + `unitCount` |
| `PATCH` | `/unit-types/:id` | Update |
| `DELETE` | `/unit-types/:id` | 409 if any units |
| `GET` | `/properties/:propertyId/units` | Paginated; `unitTypeId?`, `status?`, `isActive?`, `q?` |
| `POST` | `/properties/:propertyId/units` | Body includes `unitTypeId` (must belong to property) |
| `GET` | `/units/:id` | Full unit |
| `PATCH` | `/units/:id` | Update (`propertyId` / `unitTypeId` immutable) |
| `DELETE` | `/units/:id` | Hard delete (Restrict backstop when reservations exist later) |

Media: jsonb `MediaItem` (`coverImage` / `media[]`); `url` is an external CDN link — API does not upload or serve bytes. Field reasons: `CODE_TAKEN`, `HAS_CHILDREN`, `LAT_LNG_PAIR_REQUIRED`, `UNIT_TYPE_INVALID` (+ lat/lng range via DTO).

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

Cross-app wire types: import from `@cabin/api-contract` — envelope, codes, staff + inventory types, `Paginated` / `PageInfo`. Do not redefine those here.

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

`GET /health` → `{ data: { status: "ok", database: "up" }, meta: { requestId } }`.

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

## Domain

```text
property → unit_type (optional) → unit → reservations / blocks
```

One calendar per unit. Confirmed stays must not overlap on the same unit (Postgres exclusion / transactional write).

## Module shape

Prefer Nest feature modules: `staff-auth`, `admins`, `properties`, `unit-types`, `units`, later `reservations`, `ops`, `ingest`, `ical`.

## Code conventions

- DTOs with `class-validator` (+ `ValidationPipe`). No bare `any` on controllers.
- Prisma only inside services — not controllers.
- Use `StaffSessionAuthGuard` + `@StaffRoles(...)` / `StaffRolesGuard` for protected routes (`@StaffRoles` is minimum-role, not an exact allowlist).

## Don’t

- Scrape OTAs or remote “Import now”
- Second database for bookings
- Trust UI-only overlap checks
- Channel Manager in Phase 1
- Mix guest `User` with `Admin` (guests are Phase 2)
- Put Arcjet (or API secrets) in the frontend

Root: `AGENTS.md` · Plan: `.docs/cabin-pms-client-plan.md`
