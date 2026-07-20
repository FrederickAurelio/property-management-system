# @cabin/api-contract

Shared **HTTP wire contract** for Cabin frontends and the API.

## Layout

```text
src/          ← TypeScript source only (.ts)
dist/cjs/     ← CJS emit (Nest)
dist/esm/     ← ESM emit (Vite)
scripts/      ← clean-src-artifacts.mjs (strips stray emit in src/)
```

**Never** commit or keep `.js` / `.d.ts` / `.js.map` under `src/`. Build only via `pnpm run build` (runs `clean:src-artifacts` first). If junk reappears after IDE compile or a mistaken `tsc` on a single file, run `pnpm --filter @cabin/api-contract run clean:src-artifacts`.

## In

- Envelope types, error codes, `ApiError`
- Staff wire types (`AdminRole`, `StaffAdmin`) + credential limits — `Staff*` = staff/PMS wire shapes, **not** the public website catalog
- Inventory wire types (`StaffProperty`, `StaffUnitType`, `StaffUnit`, enums, `MediaItem`, `Amenities`, `BedConfigRoom`)
- Reservation wire types (`StaffReservation`, source/status/payment enums) + helpers (`recomputePaymentStatus`, `balanceDueIdr`, `refundDueIdr`, `suggestStayTotalIdr` — Nest must reuse; do not fork)
- Payment movement wire (`PaymentMovement`, direction/kind enums) + helpers (`signedAmountFor`, `sumPaidFromMovements`) — Paid on reservation is denormalized sum of movements; Nest must append movements, not overwrite Paid alone
- Pagination: `Paginated<T>`, `PageInfo`, `buildPageInfo`, page size bounds
- Structured field-error reasons (`ApiFieldReason`: staff + inventory — `CODE_TAKEN`, `LAT_LNG_PAIR_REQUIRED`, `HAS_CHILDREN`, …)

## Out

- Nest filters/interceptors, Prisma, React, fetch clients (those stay in apps)

## List pagination

List endpoints return domain `Paginated<T>` as `data` (envelope `meta` stays request-id only):

```ts
{ data: { items: T[]; pageInfo: PageInfo }, meta?: { requestId } }
```

## Use

```ts
import { ApiErrorCode, type StaffAdmin, type Paginated } from '@cabin/api-contract';
```

Depend with `"@cabin/api-contract": "workspace:*"`. `pnpm install` runs `prepare` → builds **dual** `dist/cjs` (Nest `require`) + `dist/esm` (Vite named `import`). Package `exports` nest `types` under both `import` and `require` so type-only members resolve in the IDE.

General packages rules: [`../README.md`](../README.md) · [`.cursor/rules/monorepo-tooling.mdc`](../../.cursor/rules/monorepo-tooling.mdc).
