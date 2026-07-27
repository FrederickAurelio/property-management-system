# Prompt: Cabin PMS iCal / OTA edge-case review

Paste this into a **new Cursor session** (Agent mode). Goal: deep review of code + product flows + online research — **do not implement** unless asked after the review.

---

You are reviewing **Cabin PMS iCal sync** (Phase 1 staff PMS ↔ OTA via native iCal only).

## Product constraints (locked — do not invent a Channel Manager)

- Monorepo: `apps/api` (Nest), `apps/pms` (staff UI), `packages/api-contract`
- Design: `_docs/reservations-design.md` §§9–11 (iCal, edge catalog, API shape)
- One calendar per **unit**; Postgres gist exclusion for occupying stays
- OTA events → `Reservation` stubs (`UNCONFIRMED`), **never** `CalendarBlock`
- `CONFIRMED` ≠ paid (money is separate)
- **Export:** live `GET` busy `.ics` (occupying stays where `!icalOverlapHold` + blocks); OTAs poll us — no push on create/cancel/checkout
- **Import:** Nest cron (~10 min) + Dashboard **Sync all**; match `(source, externalRef=UID)`
- Warnings: `MISSING_FROM_FEED` | `DATES_DIFFER` | `OTA_STILL_LISTED` | `IMPORT_OVERLAP`
- `IMPORT_OVERLAP` + `icalOverlapHold=true` → desk-visible stub that does **not** block calendar until Confirm/Cancel
- `OTA_STILL_LISTED` dismiss is **sticky**; MISSING is **property-wide** (same source feeds)
- Public export URL via `PUBLIC_PMS_BASE_URL` + PMS proxy `/public/ical/` (not raw API)
- No promise of zero double-book from iCal alone; no price sync; no OTA email ingest

## Research the codebase

Read and cite real paths/functions:

- `apps/api/src/domain/ical/` — import, export, busy, specs
- `apps/api/src/staff/ical/` — Sync all, cron scheduler
- `apps/api/src/public/ical/` — tokenized export
- `apps/api/src/domain/reservations/` — confirm, dismiss, accept-ical-dates, overlap
- `apps/api/src/domain/inventory/unit-ical.ts` — export URL builder
- Prisma: `Reservation` iCal fields, `UnitIcalFeed`, `icalExportToken`, occupying exclusion
- `packages/api-contract` — `IcalSyncWarning`, occupying helpers, `icalOverlapHold`
- PMS: unit form Calendars section, Dashboard Sync all, reservation detail iCal banners, boards (`ical-alerts`, needs-details)

## Research online too

Search for real-world Airbnb / Booking.com / Agoda / Vrbo **iCal** pitfalls that our catalog might miss, e.g.:

- Poll intervals / sync lag / double-booking windows
- Exclusive vs inclusive `DTEND`, date-only vs DATE-TIME, timezone off-by-one
- UID reuse, UID disappear delay, `STATUS:CANCELLED` still in feed
- Blocked/unavailable nights vs real bookings in the same export feed
- Opaque SUMMARY (“Reserved”, “CLOSED”)
- Empty calendars rejected by OTAs
- Feed URL rotation / 401 / dead feeds with no host alert
- Bidirectional iCal mesh loops
- HTTPS / public URL requirements for OTA import

Compare findings to our code and `_docs/reservations-design.md` §10.

## Cover all directions

1. **PMS → OTA** (our export, their poll)
2. **OTA → PMS** (their export, our cron / Sync all)
3. **OTA ↔ OTA** (mesh via PMS as hub — delay, double sell)
4. **Desk ↔ sync** (cancel, checkout, move unit, confirm hold, dismiss, accept dates, rotate token, wrong feed URL)

## Required output format

### A. Flow map (short)

### B. Edge-case matrix

Columns: `Scenario | Direction | Current code behavior | Risk (H/M/L) | Gap? (bug / product hole / inherent iCal limit / OK)`

Must include at least: overlap hold, create failure swallow, unit move + MISSING, UID after cancel/checkout, DATES_DIFFER, feed `lastError` visibility, export lag, wrong URL / empty `PUBLIC_PMS_BASE_URL`, two OTAs same nights, block-as-booking, TZ/date parse, token rotate, Sync all vs cron, sticky dismiss vs IMPORT_OVERLAP dismiss, Confirm on hold, calendar hiding holds, unique `(source,externalRef)`.

### C. Online research findings (missed industry edges)

### D. Top 5 recommended fixes / tests (prioritized)

### E. Verdict

Is the desk-facing alert model coherent, or still “bury where nobody looks”?

## Rules for the reviewer

- Be concrete: file paths + function names
- Do **not** edit code or plan files unless the user explicitly asks after the review
- Prefer inherent iCal limits vs real bugs vs product holes — don’t conflate them
- CLI truth: if claiming a bug, point at the line/behavior that proves it
