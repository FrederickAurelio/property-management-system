# apps/api

NestJS backend (`@cabin/api`). **Source of truth** for units, reservations, availability, staff auth, and ops. Serves `pms` (Phase 1) and `web` (Phase 2).

## Status

- Nest + **Prisma 6** + local Postgres (`pnpm db:up`)
- **Staff auth:** cookie sessions (`express-session` + `connect-pg-simple`), `Admin` model, roles below
- **Not yet:** property/unit/reservation modules, admin CRUD, permission matrix

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
| `GET` | `/staff/auth/me` | Current admin + role |

Cookie name: `cabin.pms.sid` (httpOnly). Logout clears the cookie. Env: `SESSION_SECRET`, `CORS_ORIGINS` (required in production), seed vars below. Production enables Express `trust proxy` for secure cookies behind TLS termination.

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

Cross-app wire types: import from `@cabin/api-contract` (see `packages/`) — envelope, codes, `AdminRole`, `PublicAdmin`. Do not redefine those here.

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

Seed (first `SUPER_ADMIN`): `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` (defaults in `.env.example`).

## Security

**Phase 1 (staff PMS):** CORS allowlist, sessions + Guards. Add helmet + login rate-limit soon.

**Later (public `web`):** [Arcjet](https://docs.arcjet.com) on the **API only**.

## Phase 1 build order

1. Staff auth + roles ← **in progress** (login done; admin CRUD next)
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

Prefer Nest feature modules: `staff-auth`, `units`, `reservations`, `ops`, later `ingest`, `ical`. Next: `admins` (SUPER_ADMIN-only CRUD).

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
