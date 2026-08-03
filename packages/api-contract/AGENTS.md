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
- Inventory wire types (`StaffProperty`, `StaffPropertyOption`, `StaffUnitType`, `StaffUnit`, `StaffUnitIcalFeed`, `StaffUnitAvailability`, `UnitMonthOccupancy`, enums, `MediaItem`, `MediaProvider`, `StaffMediaConfig`, provider-discriminated `MediaUploadIntent`, `Amenities`, `BedConfigRoom`) + `isUnitStatusBookable` / `UnitAvailabilityBlockReason`
- Archive wire types (`ArchiveItem`, `ArchiveProvider`, `StaffArchiveConfig`, `ArchiveUploadIntent`, `ARCHIVE_*` bounds) — staff proofs; parallel to inventory media, not `MediaItem`
- iCal staff wire (`StaffIcalSyncAllResult`, `UnitIcalFeedSource`, feed inputs on unit write)
- Reservation wire types (`StaffReservation` detail/mutations, `StaffReservationListItem` desk list, create/update/cancel/list filters, boards, `ReservationListSort`, `StayBillingPeriod`, `STAY_*_COUNT_MAX`) + helpers (`recomputePaymentStatus`, `balanceDueIdr`, `refundDueIdr`, `suggestStayTotalIdr`, `checkoutFromPeriodCount`, `periodCountFromRange`, `stayPeriodCountMax`, `isValidStayPeriodRange` — Nest must reuse; do not fork)
- Calendar wire types (`StaffPropertyCalendar`, `StaffCalendarStay`, `StaffCalendarBlock`, `CalendarBlockKind`, create/update block inputs) — property aggregate for unit×days grid
- Reports wire types (`StaffReportsSummary`, cash / occupancy / source mix) + period helpers (`previousEqualPeriod`, `ymdInclusiveToUtcHalfOpen`) — Nest `GET /staff/reports/summary`. Open balances stay on Reservations boards.
- Dashboard wire types (`StaffDashboard`, `StaffDashboardListItem`, `StaffDashboardAttentionKind`) — Nest `GET /staff/dashboard` (today arrivals/departures + needs attention; not period KPIs)
- Payment movement wire (`PaymentMovement`, direction/kind enums) + helpers (`signedAmountFor`, `sumPaidFromMovements`) — Paid on reservation is denormalized sum of movements; Nest must append movements, not overwrite Paid alone; stamp `createdByAdminId` from session
- Reservation staff wire includes `createdByAdminId` / `updatedByAdminId` (+ denormalized usernames) — light attribution, not a full audit log
- Pagination: `Paginated<T>`, `PageInfo`, `buildPageInfo`, page size bounds
- Structured field-error reasons (`ApiFieldReason`: staff + inventory + reservations — `OVERLAP_CONFLICT`, `UNIT_NOT_BOOKABLE`, `EARLY_CONFIRM_REQUIRED`, …)

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
