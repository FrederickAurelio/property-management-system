# Reservations design (production PMS)

**Status:** locked design intent — align before Prisma / API / PMS.  
**Depends on:** [`inventory-and-reservation-tables.md`](inventory-and-reservation-tables.md)  
**Product:** [`cabin-pms-client-plan.md`](cabin-pms-client-plan.md)

---

## 0. Phase framing

Business **already runs**: Booking.com · Airbnb · Agoda · manual / walk-in / WhatsApp. Phase 1 PMS must be **prod** for that — not a demo until the website ships.

| Phase | Is                                                                                           | Is not                                     |
| ----- | -------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **1** | Staff PMS: calendar, reservations, money/DP, check-in/out, reports, **iCal export + import** | Waiting on `apps/web`; **no** email ingest |
| **2** | Customer book FE → **same** `Reservation` / `domain/` (`source=WEBSITE`)                     | “When money/bookings start”                |

```text
Manual / walk-in ─┐
OTA iCal import  ─┼─► PMS (ops + money truth) ──export .ics──► OTAs import
                  │         ▲
Website (Ph 2) ───┘         └── staff enrich UNCONFIRMED
```

**Design rule:** one schema, one domain, staff HTTP now / public HTTP later.

---

## 1. What the desk must always see

Every reservation row answers five questions, always visible on list + detail:

| Question             | UI                                     |
| -------------------- | -------------------------------------- |
| Which unit / nights? | Unit code + date range                 |
| Ops where?           | Status badge                           |
| From where?          | Source badge                           |
| Money?               | **Total · Paid · Due** (never hide)    |
| Needs human?         | `UNCONFIRMED` and/or `icalSyncWarning` |

**Invariant:** reservation always has `unitId`. Type-then-assign is UX only; write path always stores a unit.

**Unit field UX (PMS):** label + **Choose** → inventory drill-down (Property → Unit type → Unit) → **Confirm**. Not a Select of all units. Active units only; no CRUD in the picker. Edit / already chosen opens on the unit’s layer; create with board `propertyId` starts on unit types.

```text
Unit ── Reservation   (guest stay / iCal stub)
    └── CalendarBlock (maintenance, owner, soft HOLD — not OTA busy)
```

---

## 2. Three axes (never mix)

| Axis    | Fields                                                                           | Meaning                                         |
| ------- | -------------------------------------------------------------------------------- | ----------------------------------------------- |
| Channel | `source`                                                                         | MANUAL · WEBSITE · BOOKING_COM · AIRBNB · AGODA |
| Ops     | `status`                                                                         | Lifecycle on the property                       |
| Money   | `totalAmountIdr`, `paidAmountIdr` (sum of movements), `paymentStatus`, movements | Quote / received / due·refund                   |

`CONFIRMED` ≠ paid. Money is independent so desk can have `CONFIRMED + DEPOSIT` or `CHECKED_IN + UNPAID`.

---

## 3. Front desk operating model (predictable UX)

### 3.1 Daily boards (same filters everywhere)

Phase 1 desk boards live on **Reservations** (`/reservations`) only — **no** separate Check-in page. Check-in / check-out actions run from list → detail (and later calendar).

| Board             | Default filter                                                                   | Primary job                                                                     |
| ----------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Arrivals**      | `status = CONFIRMED` and `checkInDate ≤ today < checkOutDate` (includes overdue) | Collect due → Check in                                                          |
| **In-house**      | `status = CHECKED_IN`                                                            | Extend / collect / Check out                                                    |
| **Balance due**   | Due > 0 **or** Refund > 0 (overpay), status occupying **or** `CHECKED_OUT`       | Collect / Refund                                                                |
| **Departures**    | `status = CHECKED_IN` and `checkOutDate ≤ today` (includes overdue)              | Check out                                                                       |
| **Needs details** | `status = UNCONFIRMED`                                                           | Enrich → Confirm                                                                |
| **OTA issues**    | `icalSyncWarning IS NOT NULL` (board id `ical-alerts`)                           | Playbook on detail: verify on OTA → primary Cabin action → OTA step if required |

Arrivals matches the check-in window; Departures matches due/overdue checkout (not “today only”). Sort Arrivals by `checkInDate` asc, Departures by `checkOutDate` asc (oldest overdue first). List `sort=openAmount` orders by highest open amount first (`max(Due, Refund)` — same metric as Dashboard Needs attention); PMS exposes that sort **only** on Balance due (auto-selected on enter; leaving the board resets to Stay date). PMS shows **Late arrival** / **Late departure** badges on list + detail wherever the row appears (not only on those boards). Past `checkOutDate` without ever checking in → find under All → **Cancel** (no-show notes); no separate `NO_SHOW` status.

**List stay-touch filter** (`from` / `to`, inclusive YYYY-MM-DD): on lookup boards only (`all`, `needs-details`, `ical-alerts`, `balance-due`, `in-house`). Predicate: `checkInDate ≤ to AND checkOutDate ≥ from` (checkout on the `from` day still matches). Default = no range (all time). Hidden on Arrivals / Departures.

Calendar is the spatial view of the same rows — same badges, same click-through to detail. Full page spec: [`calendar-design.md`](calendar-design.md). Desk home triage (today in/out + exceptions, not full boards): [`dashboard-design.md`](dashboard-design.md).

### 3.2 One detail page — primary actions by status

Only **one primary button** (filled). Everything else secondary. Money block always on the right/top.

| Status        | Primary                                                    | Secondary                                                                                          |
| ------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `UNCONFIRMED` | **Confirm** (opens enrich form if incomplete)              | Cancel · Edit dates/unit                                                                           |
| `CONFIRMED`   | **Check in** (if `checkInDate <= today`)                   | Collect / Refund · Edit · Cancel                                                                   |
| `CHECKED_IN`  | **Check out** (if `checkOutDate <= today` **or** early OK) | Collect · Edit dates · Cancel (confirm)                                                            |
| `CHECKED_OUT` | —                                                          | **Collect** only if Due > 0 · **Refund** only if overpaid · hidden when settled · no Edit / reopen |
| `CANCELLED`   | —                                                          | Money closed at Cancel sheet · no Collect · no Edit / reopen                                       |

**Predictability rules**

1. Same action names on calendar popover, list row, and detail.
2. Illegal actions are **hidden**, not error-after-click (BE still enforces).
3. Any cash action uses the **same Collect sheet** (amount → posts `PaymentMovement`; Paid = sum).
4. Cancel always uses the **same Cancel sheet**: reason/notes optional + money disposition if `paid > 0`.
5. Warnings (`icalSyncWarning`, balance due) use one banner pattern — never a different modal language per screen. OTA sync warnings use a **playbook card** on detail: title (plain language + channel) → what happened → (1) check on OTA (2) primary Cabin CTA (3) OTA step when required → Dismiss with sticky vs reappears hint. List/boards show the playbook title, not a bare icon. Desk UI says **OTA** / channel name (Booking.com, Airbnb, Agoda); keep `ical-*` ids in code/URL.

### 3.3 Roles (locked for Phase 1)

| Action                                       | `FRONT_DESK`                           | `ADMIN` / `SUPER_ADMIN` |
| -------------------------------------------- | -------------------------------------- | ----------------------- |
| Create / edit / confirm / check-in / out     | Yes                                    | Yes                     |
| Collect / refund via movements               | Yes                                    | Yes                     |
| Cancel                                       | Yes                                    | Yes                     |
| Mid-stay cancel (`CHECKED_IN` → `CANCELLED`) | Yes + confirm dialog                   | Yes                     |
| Delete reservation hard                      | **No**                                 | **No** (cancel only)    |
| iCal feed URL settings                       | No (may view unit; escalate URL fixes) | Yes                     |

---

## 4. How bookings enter

| Channel                           | Create as     | Occupies? | Money at create                     |
| --------------------------------- | ------------- | --------- | ----------------------------------- |
| Manual / walk-in / WA             | `CONFIRMED`   | Yes       | Staff: total + paid (0 / DP / full) |
| OTA typed by hand (extranet open) | `CONFIRMED`   | Yes       | Staff from extranet                 |
| iCal pull                         | `UNCONFIRMED` | Yes       | Unknown                             |
| Website (Phase 2)                 | `CONFIRMED`   | Yes       | Checkout                            |

```text
Manual ──► CONFIRMED (+ money)
iCal   ──► UNCONFIRMED ──enrich──► CONFIRMED
Web    ──► CONFIRMED (Phase 2)
```

If staff already has full OTA details, **create CONFIRMED by hand** (source = that OTA). If an `UNCONFIRMED` stub already exists for same unit+overlap+source, **enrich that row** — do not create a second (BE rejects overlap).

---

## 5. Ops status machine

```text
ReservationStatus
  UNCONFIRMED   # iCal stub — needs details
  CONFIRMED     # ops-ready (≠ paid)
  CHECKED_IN
  CHECKED_OUT   # terminal
  CANCELLED     # terminal (guest/OTA cancel, walk-away / no-arrival write-off — one Cancel sheet)
```

### Occupies calendar

`UNCONFIRMED` · `CONFIRMED` · `CHECKED_IN` only.

### Transitions

```text
UNCONFIRMED → CONFIRMED | CANCELLED
CONFIRMED   → CHECKED_IN | CANCELLED
CHECKED_IN  → CHECKED_OUT | CANCELLED
```

No skip `UNCONFIRMED → CHECKED_IN`. No reopen from terminal in Phase 1.

### Timing gates (desk-friendly, not pedantic)

| Action                                | Allowed when                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| Check in                              | `status=CONFIRMED` and `checkInDate <= today < checkOutDate`                    |
| Early check-in (before `checkInDate`) | Allowed with confirm (“early?”) — `FRONT_DESK+`                                 |
| Check out                             | `status=CHECKED_IN` and `today <= checkOutDate` **or** early checkout confirm   |
| Late checkout (after `checkOutDate`)  | Still allow check out + note. **DAILY:** unit free for overlap from `checkOutDate` (inventory end = contract out). **MONTHLY/YEARLY:** unit stays blocked until `CHECKED_OUT` or `CANCELLED` (open inventory hold from check-in → FAR) |

Timestamps: `confirmedAt`, `checkedInAt`, `checkedOutAt`, `cancelledAt`.

**No separate `NO_SHOW` status.** Guest never arrived → **Cancel** (same sheet / money disposition); optional notes e.g. “no-show”.

---

## 6. Money

Desk meaning of `paymentStatus`: **“what does the guest still owe at the property?”** — not bank reconciliation to a gateway.

**Locked model:** quote vs cash are separate.

| Concept     | Storage                            | Changed by                                                                     |
| ----------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| **Quote**   | `Reservation.totalAmountIdr`       | Edit stay / create form                                                        |
| **Cash**    | Append-only `PaymentMovement` rows | Collect (IN/OUT), Cancel refund, create opening DP                             |
| **Paid**    | `Reservation.paidAmountIdr`        | **Denormalized cache** = `sum(movements.signedAmount)` — never overwrite alone |
| **Balance** | Derived                            | Due = max(total − paid, 0); Refund = max(paid − total, 0)                      |

```text
UNPAID    paid = 0
DEPOSIT   0 < paid < total   (total required)
PAID      paid >= total      (total required; includes overpay → Due = 0, Refund > 0)
REFUNDED  explicit after cancel full-refund (or paid driven to 0 on cancel path)
```

| Reservation column | Null              | Notes                                                   |
| ------------------ | ----------------- | ------------------------------------------------------- |
| `totalAmountIdr`   | yes until confirm | Whole IDR; **0 allowed** (complimentary)                |
| `paidAmountIdr`    | no, default 0     | Cache from movements                                    |
| `paymentStatus`    | no                | Recomputed from total vs paid (except force `REFUNDED`) |
| `collectedVia`     | yes               | Optional rollup: latest movement method                 |

### `PaymentMovement` (cash ledger)

| Column                           | Notes                                                                     |
| -------------------------------- | ------------------------------------------------------------------------- |
| `id` / `reservationId`           |                                                                           |
| `direction`                      | `IN` \| `OUT`                                                             |
| `kind`                           | `DEPOSIT` \| `TOP_UP` \| `REFUND` \| `CANCEL_REFUND` \| `CHANNEL_SETTLED` |
| `amountIdr`                      | always `> 0`                                                              |
| `signedAmount`                   | `+amount` (IN) or `−amount` (OUT)                                         |
| `method`                         | `PROPERTY` \| `CHANNEL` \| `MIXED` \| null                                |
| `note`                           | optional                                                                  |
| `createdAt` / `createdByAdminId` | audit — who posted cash; no full edit history table in Phase 1            |

Helpers in `@cabin/api-contract`: `signedAmountFor`, `sumPaidFromMovements`, `balanceDueIdr`, `refundDueIdr`.

**Not movements:** Total edits, guest/date/unit patches. Shrink after full pay → Refund due until staff posts an OUT.

```text
recompute paymentStatus:
  REFUNDED if explicitly set (cancel full / paid→0 cancel)
  else null total → UNPAID
  else paid <= 0 → UNPAID
  else paid < total → DEPOSIT
  else → PAID
```

### Staff money actions (one Collect sheet)

Cash-first — posts **one** movement per save. Total quote stays on Edit stay.

| Intent              | Input                      | Result                                                   |
| ------------------- | -------------------------- | -------------------------------------------------------- |
| Collect DP / top-up | amount ≤ Due, method, note | Movement `IN` (`DEPOSIT` / `TOP_UP` / `CHANNEL_SETTLED`) |
| Collect full Due    | shortcut amount = Due      | Same IN                                                  |
| Refund excess       | amount ≤ Refund            | Movement `OUT` (`REFUND`)                                |
| Refund full excess  | shortcut amount = Refund   | Same OUT                                                 |

Do **not** expose absolute Paid rewrite as the desk path.

### OTA money (simple rule)

| Case                           | Do this                                                     |
| ------------------------------ | ----------------------------------------------------------- |
| Pay at property                | total from extranet; leave `UNPAID` until Collect IN        |
| Already paid on Airbnb/Booking | total + Collect full Due with `CHANNEL` / `CHANNEL_SETTLED` |
| iCal stub                      | leave null total until Confirm                              |

### Cancel + money (one Cancel sheet)

If `paid == 0`: cancel → `CANCELLED` + `UNPAID`.  
If `paid > 0`: staff **must** pick:

| Choice                   | Effect                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| Full refund              | OUT `CANCEL_REFUND` for full Paid → paid 0, `REFUNDED`, then `CANCELLED`                     |
| Keep payment (no refund) | no movement; amounts stay; `CANCELLED`                                                       |
| Partial refund           | Body `refundAmountIdr` (amount returned to guest) → OUT that amount; property keeps the rest |

Cancel `POST` body when paid > 0: `{ disposition, refundAmountIdr?, notes? }` — never send “remaining Paid”; cash is always a movement amount.

### Extend / shrink dates

Staff **PATCH dates** (overlap checked).

**Locked Total suggestion (FE = BE later):**

```text
suggestedTotal =
  DAILY   → nights  × UnitType.defaultPriceIdr
  MONTHLY → months  × UnitType.monthlyPriceIdr
  YEARLY  → years   × UnitType.yearlyPriceIdr
```

`Reservation.billingPeriod` records which axis was used. Monthly/yearly exclusive check-out = same calendar date + N periods (`26 Jun → 26 Jul`); missing days clamp to EOM (`31 Jan → 28/29 Feb`). Caps: monthly ≤ 120, yearly ≤ 30 (`STAY_*_COUNT_MAX`). Helpers: `checkoutFromPeriodCount` / `periodCountFromRange` / `suggestStayTotalIdr` in `@cabin/api-contract`.

**Inventory vs contract (locked):** contract `checkInDate`/`checkOutDate` drive money and boards. For `MONTHLY`/`YEARLY` occupying stays, `inventoryEndDate` = FAR (`9999-12-31`) so the unit stays blocked from check-in until `CHECKED_OUT`/`CANCELLED` (extend by editing contract dates; inventory hold remains open). DAILY: `inventoryEndDate = checkOutDate`.

| Trigger                                   | Total            | Paid / movements                                             |
| ----------------------------------------- | ---------------- | ------------------------------------------------------------ |
| Create with unit + dates                  | Fill suggested   | Opening `depositAmountIdr` > 0 → first IN `DEPOSIT`          |
| Unit type, period, or period-count change | Set to suggested | **Never change Paid / movements**                            |
| Open edit (no period/type change)         | Keep saved Total | Keep Paid                                                    |
| Staff edits Total by hand                 | Keep override    | Paid stays; if `paid > total` → **Refund** until Collect OUT |

```text
Due     = max(total − paid, 0)
Refund  = max(paid − total, 0)   # settle via Collect OUT — never silent clamp
```

Extend after full pay → Total rises, Paid stays → Due → Collect IN.  
Shrink after full pay → Total falls, Paid stays → Refund → Collect OUT. Do **not** auto-post a refund when Total shrinks.

iCal date change on `UNCONFIRMED`: auto-apply. On `CONFIRMED+`: **warn only** (`DATES_DIFFER`) — staff Accept or Keep.

Nest persists `PaymentMovement` with `/staff/reservations`; PMS uses the live API.

---

## 7. Required fields (FE = BE)

| Field              | `UNCONFIRMED`  | `CONFIRMED`+                            |
| ------------------ | -------------- | --------------------------------------- |
| unit + dates       | Required       | Required                                |
| `guestName`        | Placeholder OK | **Real name** (reject `*(iCal)` suffix) |
| phone **or** email | Optional       | **Required (one of)**                   |
| `guestCount`       | Optional       | `>= 1` and `<= maxGuests`               |
| `totalAmountIdr`   | Optional null  | **Required `>= 0`**                     |
| `paidAmountIdr`    | 0              | `>= 0`                                  |

Confirm and manual-create-as-`CONFIRMED` use the same matrix.  
Check-in: **warn** if Due > 0 — do not hard-block.  
Check-out: same — allow with Due > 0; **Collect** remains available after `CHECKED_OUT`.  
Early/late check-out: dates unchanged unless staff **Edit** first; iCal busy follows occupying status (not a manual calendar open).

---

## 8. Table sketch: `Reservation`

| Column                                  | Null | Notes                                                                                            |
| --------------------------------------- | ---- | ------------------------------------------------------------------------------------------------ |
| `id`                                    | no   | cuid                                                                                             |
| `propertyId` / `unitId` / `unitTypeId`  | no   | type snapshot at create                                                                          |
| `source` / `status`                     | no   |                                                                                                  |
| `billingPeriod`                         | no   | `DAILY` \| `MONTHLY` \| `YEARLY` (default `DAILY`)                                               |
| `checkInDate` / `checkOutDate`          | no   | inclusive / exclusive                                                                            |
| `guestName`                             | no   |                                                                                                  |
| `guestEmail` / `guestPhone`             | yes  | one required when confirmed                                                                      |
| `guestCount`                            | yes  | required when confirmed                                                                          |
| `notes`                                 | yes  |                                                                                                  |
| `totalAmountIdr`                        | yes  |                                                                                                  |
| `paidAmountIdr`                         | no   | default 0; **cache** = sum(`PaymentMovement.signedAmount`)                                       |
| `paymentStatus`                         | no   |                                                                                                  |
| `collectedVia`                          | yes  | optional rollup                                                                                  |
| `externalRef`                           | yes  | OTA id or iCal UID                                                                               |
| `icalSyncWarning`                       | yes  | `MISSING_FROM_FEED` \| `DATES_DIFFER` \| `OTA_STILL_LISTED` \| `IMPORT_OVERLAP` \| `UNIT_DIFFER` |
| `icalSyncWarnedAt`                      | yes  |                                                                                                  |
| lifecycle timestamps                    | yes  |                                                                                                  |
| `createdByAdminId` / `updatedByAdminId` | yes  |                                                                                                  |

### `PaymentMovement`

| Column                           | Null | Notes                                                                     |
| -------------------------------- | ---- | ------------------------------------------------------------------------- |
| `id` / `reservationId`           | no   |                                                                           |
| `direction`                      | no   | `IN` \| `OUT`                                                             |
| `kind`                           | no   | `DEPOSIT` \| `TOP_UP` \| `REFUND` \| `CANCEL_REFUND` \| `CHANNEL_SETTLED` |
| `amountIdr`                      | no   | > 0                                                                       |
| `signedAmount`                   | no   | +/− amount                                                                |
| `method`                         | yes  | `PROPERTY` \| `CHANNEL` \| `MIXED`                                        |
| `note`                           | yes  |                                                                           |
| `createdAt` / `createdByAdminId` |      |                                                                           |

Indexes: unit+dates, property+checkIn/Out, status, paymentStatus, source, warning; `UNIQUE (source, externalRef)` where ref set; movements by `reservationId` + `createdAt`.  
Overlap: occupying statuses + blocks — Postgres / transactional, never UI-only.

### `CalendarBlock`

`MAINTENANCE` \| `OWNER` \| `HOLD` \| `OTHER` — non-guest only. OTA busy = `Reservation` `UNCONFIRMED`, not a block.

---

## 9. iCal

### Where do feed URLs live?

**Import:** child table `UnitIcalFeed` (multiple OTAs per unit).  
**Export:** created **automatically with the unit** — one copyable PMS `.ics` link per unit (`Unit.icalExportToken`).

```text
Create unit
  → DB: Unit + icalExportToken (auto)
  → UI: show “PMS calendar link” (Copy)
  → UI: fields to paste OTA export URLs (Booking / Airbnb / Agoda…)
  → saved as UnitIcalFeed rows

Background worker (cron)
  → pulls all active UnitIcalFeed URLs on a timer
  → no Sync button on the unit form

Optional: one “Sync all” (Dashboard `/`; Calendar optional later)
  → FRONT_DESK+ can force a full pull now
```

| Direction              | Stored where                               | How many                                | UI                                                        |
| ---------------------- | ------------------------------------------ | --------------------------------------- | --------------------------------------------------------- |
| **Export** (PMS → OTA) | `Unit.icalExportToken` → public `.ics` URL | **One** per unit                        | Auto on create · **Copy** (paste into each OTA import)    |
| **Import** (OTA → PMS) | `UnitIcalFeed.importUrl` + `source`        | **Multiple** (`UNIQUE(unitId, source)`) | Fields on **Create / Edit unit** (or same dialog section) |

Yes: multiple OTA imports per unit.  
No: per-unit “Sync now” on that form — sync is **automatic** via worker. Staff may use **one global Sync all**.

### Table: `UnitIcalFeed` (import)

| Column                           | Type            | Null | Notes                                   |
| -------------------------------- | --------------- | ---- | --------------------------------------- |
| `id`                             | cuid PK         | no   |                                         |
| `unitId`                         | FK → Unit       | no   | `ON DELETE CASCADE`                     |
| `source`                         | enum            | no   | `BOOKING_COM` \| `AIRBNB` \| `AGODA`    |
| `importUrl`                      | `varchar(2048)` | no   | OTA calendar **export** URL staff paste |
| `isActive`                       | boolean         | no   | default true                            |
| `lastPulledAt` / `lastSuccessAt` | timestamptz     | yes  | Worker updates                          |
| `lastError`                      | text            | yes  |                                         |
| `createdAt` / `updatedAt`        | timestamptz     | no   |                                         |

**Constraints:** `UNIQUE (unitId, source)`.  
**Who edits URLs:** `ADMIN+` on unit create/edit. Front desk uses Sync all + enrich / OTA issues queues; does not edit URLs daily. Dashboard failing-feed copy links to the property explorer and tells FRONT_DESK to ask an admin when they cannot edit Calendars.

### Unit form UX (Create / Edit)

Same modal/page as unit identity is OK for this slice:

1. **PMS export link** — read-only + Copy (always present after create).
2. **OTA imports** — up to one URL per source (Booking / Airbnb / Agoda); empty = not connected.
3. **No Sync button here.**

Optional later: move the block to a “Calendars” tab if the form feels crowded — data model stays the same.

### Automatic sync (worker)

- Cron (e.g. every 5–15 min) pulls every `isActive` feed.
- **Sync all** (one button on Dashboard `/`; Calendar optional later): enqueue the same pull job now.
- Failures → `lastError` on that feed; UI shows **Last sync failed:** under the URL on unit Calendars **and** a compact failing-feed link on Dashboard (`icalFeedHealth`) so FRONT_DESK sees it without editing URLs (escalate to ADMIN when they cannot fix the URL).

### Desk playbook UX (OTA issues)

Desk copy says **OTA** / channel name — not “iCal”. Shared playbook map (one per `icalSyncWarning`):

| Warning             | Primary Cabin CTA                           | OTA step required?                             |
| ------------------- | ------------------------------------------- | ---------------------------------------------- |
| `MISSING_FROM_FEED` | Cancel this stay                            | Verify on channel; dismiss if feed looks wrong |
| `DATES_DIFFER`      | Use {channel} dates                         | Yes — or change dates on channel               |
| `UNIT_DIFFER`       | Move to {channel}’s unit                    | Yes — or move booking on channel               |
| `IMPORT_OVERLAP`    | Nights are free now (+ Cancel this booking) | Yes if you cancel a false OTA sell             |
| `OTA_STILL_LISTED`  | Dismiss — I checked                         | Yes — cancel/update on channel if still listed |

Detail banner: **what happened** → **Pick one** (when two outcomes) → check / Cabin / OTA steps → CTAs. Every mutating playbook CTA opens a **confirm dialog** first (Accept dates/unit, Nights are free now, Dismiss). Cancel opens the Cancel sheet. List titles: Gone from… / Dates don’t match / Still on… / Double-booked nights / Wrong unit.

### Import pull behavior

Match `(source, externalRef=uid)` → insert `UNCONFIRMED` or update; never clobber enriched guest/money on `CONFIRMED+`.  
If new UID overlaps an occupying stay/block on that unit → still insert `UNCONFIRMED` with `IMPORT_OVERLAP` + `icalOverlapHold=true` (excluded from calendar busy / gist until Confirm or Cancel).  
Unrecovered insert errors fail the pull (`lastError`, no `lastSuccessAt`); unique `(source, externalRef)` races re-reconcile the existing row.

**Empty / zero-event body:** HTTP OK with `0` active booking events and **no** `STATUS:CANCELLED` tombstones → set `lastError` (“0 events…”), **do not** run MISSING / still-listed clear, leave prior `lastSuccessAt`. Covers truly empty calendars and block-only feeds (glitch / host-block noise).  
**Cancelled-only feed:** at least one `STATUS:CANCELLED` UID and no active bookings → successful pull; run MISSING for occupying UIDs no longer active (cancelled UIDs are not counted as seen).

**Skip non-bookings (no auto `CalendarBlock`):** ignore `STATUS:CANCELLED` and block-like SUMMARY markers (`unavailable`, `not available`, `blocked`, `no vacancy`, `closed`).

**Dates:** all-day `VALUE=DATE` → UTC date slice; timed `DATE-TIME` → Y-M-D in `Property.timezone`.

### UID disappeared

**No new ops status.** Set `icalSyncWarning = MISSING_FROM_FEED` only when the UID is absent from **all** active same-source feeds on the property (not merely the current unit’s feed — avoids false cancel alarms after a unit move). If the UID is found on a **sibling** unit’s same-source feed → `UNIT_DIFFER` + `icalObservedUnitId` + observed OTA dates (staff **Accept OTA unit**; banner shows date drift too when dates also differ). If sibling feed lookups fail after retries → leave warning unchanged (do **not** false-MISSING). Only run this scan after a successful parse with active bookings and/or CANCELLED tombstones.

| Local status  | Auto                   | Staff                             |
| ------------- | ---------------------- | --------------------------------- |
| `UNCONFIRMED` | Warn (not auto-cancel) | Cancel if verified gone           |
| `CONFIRMED`   | Warn only              | Verify OTA → Cancel sheet + money |
| `CHECKED_IN`  | Warn + urgent          | Investigate — never auto-cancel   |
| Terminal      | Ignore                 | —                                 |

UID returns → clear warning.  
`DATES_DIFFER` on `CONFIRMED+` → Accept (apply + revisit money) or **Dismiss for now** (non-sticky — next sync re-warns while mismatch remains).

Staff date/unit edit, cancel, or check-out on an OTA-linked stay (`externalRef` + Booking.com / Airbnb / Agoda): PMS + export update immediately; PMS shows a blocking **Got it** checklist dialog (“Update / Cancel on {channel} too”) — the guest booking on the OTA does not change automatically. Accept OTA dates/unit does **not** show this (Cabin is matching the channel). Source is **locked** while `externalRef` is set (changing channel would free `(source, UID)` and risk a duplicate stub).

`UNIT_DIFFER` stores observed unit + OTA dates. Accept unit moves the row; if OTA dates still differ → set `DATES_DIFFER` immediately (no wait for cron).

### UID returns after Cancel / Check-out

**Do not revive** the terminal row. Set `icalSyncWarning = OTA_STILL_LISTED` (desk boards + detail).  
**Dismiss** is sticky for this warning (`icalOtaStillListedDismissedAt`) — sync will not re-set while the UID stays in the feed.  
Clear warning + dismiss ack when this unit’s feed no longer lists the UID (a later reappearance can warn again).  
Feed `lastError` is for pull failures only — not this case.

### Export URL (PMS → OTA)

`GET /public/ical/units/:unitId.ics?token=…` — busy ranges only (occupying reservations + blocks). No PII.  
Staff copy once → paste into each OTA’s **import** calendar. Rotate token = ADMIN (invalidates old link).

### OTA topology: hub (prod target) vs mesh (bootstrap)

**Prod target = hub.** Mesh was a valid bootstrap while PMS was new; migrate unit-by-unit when PMS is trusted.

| Topology             | OTA extranet wiring                                      | PMS import (unchanged)                                   | PMS desk                                                                                    |
| -------------------- | -------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Hub** (target)     | Each OTA imports **only** the PMS export `.ics` per unit | One `UnitIcalFeed` per source (Booking / Airbnb / Agoda) | One `UNCONFIRMED` per real OTA booking                                                      |
| **Mesh** (bootstrap) | OTAs also import each other’s export URLs (peer OTA↔OTA) | Same                                                     | Same booking can echo as 2–3 stubs (different UIDs); echoes often get `IMPORT_OVERLAP` hold |

```text
HUB (target)
  Booking / Airbnb / Agoda  ──export──►  PMS imports (cron + Sync all)
  walk-in / website ─────────────────►  PMS calendar truth
  PMS export .ics / unit  ──import──►  each OTA (only peer link they need)

MESH (bootstrap — remove peer links after hub verified)
  Airbnb ◄──iCal──► Booking ◄──iCal──► Agoda   ← drop these when hub is live
         └──────── PMS imports each OTA ────────┘   ← keep always
```

**Why hub:** iCal has no cross-channel booking id. Importer dedupes on `(source, externalRef=UID)` only — not “same nights = same guest.” Mesh echoes look like separate bookings; hub avoids most echoes because non-booking OTAs block via **PMS export**, not re-exported peer feeds.

**Why we do not auto-merge mesh echoes in code:** echo vs real double-book (mesh delay) look identical (different UIDs, same nights, different sources). `IMPORT_OVERLAP` + `icalOverlapHold` surfaces real conflicts; block-like SUMMARY rows are already skipped. Heuristic cross-OTA merge would hide rare true double-sells.

**OTAs blocking from hub:** After a booking (OTA, walk-in, or website), PMS export includes busy nights → each OTA **imports** that feed on **its** poll schedule (hours, not instant). PMS Sync all refreshes **our** copy only — staff still **Refresh / Import now** on OTAs when last-minute. iCal delay risk remains; hub reduces echo noise, not physics.

**Migrate mesh → hub (per unit, when ready):**

1. PMS export URL pasted on Booking, Airbnb, and Agoda; verify a test block appears on each (manual refresh if needed).
2. Staff use PMS daily; feeds pull without chronic `lastError`; Sync all trusted.
3. **Optional overlap:** run hub + mesh briefly (redundant, safer).
4. On each OTA extranet, **remove peer OTA import URLs** — keep **only** the PMS export URL. **Do not** remove OTA→PMS import URLs in the unit form.
5. Watch 1–2 weeks: fewer echo stubs; real bookings still one row per channel.

**Do not** drop peer mesh before step 1 — OTAs may show open nights until they pull PMS export. See [`cabin-pms-client-plan.md`](cabin-pms-client-plan.md) §4.

### Desk: refresh OTA imports (optional nudge)

PMS export updates immediately when nights become busy; OTAs pull on **their** schedule (hours). Staff can speed this with extranet **Refresh / Import now** — PMS cannot trigger it remotely.

Two reminder families in PMS (`OtaRemindDialog`):

| Family                  | When                                                                                                                                       | Copy                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| **A — update source**   | Staff edit dates/unit, cancel, or check-out on an OTA-linked stay                                                                          | Fix the **guest booking** on the source channel (existing) |
| **B — refresh imports** | Staff **confirm** iCal stub, **create** walk-in, **edit** non–OTA-linked stay dates/unit, or **create/update** calendar block (dates/unit) | Pull **PMS export** on peer channels                       |

Family **B** triggers (after success, non-blocking **Got it**):

- Confirm UNCONFIRMED → CONFIRMED (reservation detail)
- Create manual / walk-in reservation (reservations + calendar)
- Edit manual / non–OTA-linked stay when dates or unit change
- Create calendar block; update block when dates or unit change (not note-only)

Not triggered: auto iCal import, enrich-save only, check-in, cancel/check-out/block delete (family A or defer).

Extranet labels: Booking.com **Import now** · Airbnb **Refresh** · Agoda **Refresh connections**. Copy builder: `apps/pms/src/lib/ota-remind.ts`.

---

## 10. Edge-case catalog (prod)

| #   | Situation                                                      | Expected behavior                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Save overlaps occupying stay/block                             | **409** `CONFLICT`; FE shows who conflicts (guest/source/dates)                                                                                                                                                                                                                                                                                                                                                           |
| 2   | iCal stub exists; staff creates manual same unit/dates         | Overlap 409 — open stub and Confirm instead                                                                                                                                                                                                                                                                                                                                                                               |
| 3   | Two OTA feeds mark same nights (mesh echo or real double-book) | Second UID → `UNCONFIRMED` with `IMPORT_OVERLAP` + `icalOverlapHold` (not calendar-busy). Hub reduces echoes; edge case stays for true conflicts. Desk: Cancel echo stub or free nights then Confirm real guest                                                                                                                                                                                                           |
| 4   | Walk-in while export not yet pulled by OTA                     | Known delay window; SOP refresh OTA if last-minute                                                                                                                                                                                                                                                                                                                                                                        |
| 5   | Guest paid Airbnb; Due would confuse check-in                  | Mark paid (+ optional CHANNEL) so Due = 0                                                                                                                                                                                                                                                                                                                                                                                 |
| 6   | Complimentary / owner friend                                   | `total = 0`, Mark paid or leave `PAID` with paid 0→ treat `total=0` and `paid=0` as `PAID` (due 0)                                                                                                                                                                                                                                                                                                                        |
| 7   | Overpay `paid > total`                                         | `PAID`, Due = 0                                                                                                                                                                                                                                                                                                                                                                                                           |
| 8   | Extend after full pay                                          | Raise total → Due appears; Collect IN top-up                                                                                                                                                                                                                                                                                                                                                                              |
| 9   | Shrink after full pay                                          | Lower total; Paid stays; Refund = paid − total; Collect OUT                                                                                                                                                                                                                                                                                                                                                               |
| 10  | Move to another unit                                           | PATCH `unitId` if free for range; keep money/guest. If OTA moves the listing (UID on sibling feed) → `UNIT_DIFFER` + observed unit/dates — staff **Accept OTA unit** (overlap-checked) or Dismiss for now. Accept unit may raise `DATES_DIFFER` immediately if dates also drifted. No false `MISSING_FROM_FEED` while the UID still appears on any same-source feed (or while sibling lookup is incomplete after retries) |
| 11  | Unit set `MAINTENANCE` with future stays                       | Allow unit status change with **warning** listing future occupying rows — do not auto-cancel                                                                                                                                                                                                                                                                                                                              |
| 12  | Early check-in / early check-out                               | Allowed with confirm; dates unchanged unless staff edits                                                                                                                                                                                                                                                                                                                                                                  |
| 13  | Guest never arrived                                            | Cancel (notes optional) → frees unit; money via Cancel sheet if paid                                                                                                                                                                                                                                                                                                                                                      |
| 14  | Cancel after DP / full pay                                     | Cancel sheet forces refund disposition                                                                                                                                                                                                                                                                                                                                                                                    |
| 15  | OTA cancel (UID gone) after Confirm                            | Warning queue → human Cancel + money                                                                                                                                                                                                                                                                                                                                                                                      |
| 16  | OTA date change after Confirm                                  | `DATES_DIFFER` → Accept/Keep                                                                                                                                                                                                                                                                                                                                                                                              |
| 17  | Re-pull after staff cancelled/checked out; same UID returns    | Do **not** revive; set `OTA_STILL_LISTED` on that reservation (OTA issues board / Dashboard / detail). Desk: fix OTA or **Dismiss** (sticky — will not re-warn while UID stays in feed). Clear warning + dismiss ack when UID leaves this unit’s feed                                                                                                                                                                     |
| 18  | iCal SUMMARY looks like a person                               | May seed `guestName`; Confirm still requires contact + total                                                                                                                                                                                                                                                                                                                                                              |
| 19  | Same-day turnaround                                            | Exclusive checkout: morning out / evening in OK on same date                                                                                                                                                                                                                                                                                                                                                              |
| 20  | Check-in with Due > 0                                          | Warn + allow (pay-at-property)                                                                                                                                                                                                                                                                                                                                                                                            |
| 21  | Edit guest after check-in                                      | Allowed (typos); money/dates separate                                                                                                                                                                                                                                                                                                                                                                                     |
| 22  | Multi-property                                                 | All boards scoped by selected `propertyId`                                                                                                                                                                                                                                                                                                                                                                                |
| 23  | Sync now fails / empty feed body                               | Keep last good data; feed `lastError` on unit Calendars + Dashboard `icalFeedHealth`; empty body does **not** MISSING-storm                                                                                                                                                                                                                                                                                               |
| 24  | Export token leaked                                            | Rotate token on unit/feed settings (ADMIN)                                                                                                                                                                                                                                                                                                                                                                                |

---

## 11. Backend shape

```text
domain/reservations|calendar-blocks|availability
staff/reservations|calendar|calendar-blocks
public/ical (+ Phase 2 book)
```

| Method      | Path                                                                    | Notes                                                                                                                    |
| ----------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `GET/POST`  | `/staff/reservations`                                                   | Filters: property, status, source, dates, warning, q                                                                     |
| `GET/PATCH` | `/staff/reservations/:id`                                               |                                                                                                                          |
| `POST`      | `.../confirm`                                                           | Matrix §7                                                                                                                |
| `POST`      | `.../check-in` \| `check-out`                                           |                                                                                                                          |
| `POST`      | `.../cancel`                                                            | Body: `disposition` + optional `refundAmountIdr` (partial) + `notes` — cash = movement OUT, never remaining-Paid rewrite |
| `POST`      | `.../payments` (or `.../movements`)                                     | Body: `direction` · `kind` · `amountIdr` · `method?` · `note?` — Paid = sum                                              |
| `PATCH`     | `.../` (total quote only)                                               | Total on reservation; do not PATCH absolute Paid                                                                         |
| `POST`      | `.../accept-ical-dates` \| `accept-ical-unit` \| `dismiss-ical-warning` | Accept unit moves to observed sibling feed (overlap-checked)                                                             |
| `GET`       | `/staff/properties/:propertyId/calendar`                                |                                                                                                                          |
| CRUD        | `/staff/calendar-blocks`                                                |                                                                                                                          |
| `GET`       | `/public/ical/units/:unitId.ics`                                        | tokenized export                                                                                                         |

---

## 12. Happy-path flows (desk)

**Walk-in:** Choose unit → period (daily/monthly/yearly) + dates → Total auto `periodCount × matching rack` (staff may override) + paid → guest + contact → Save `CONFIRMED` → (export blocks OTA on delay).

**Arrival:** Arrivals board → see Due → Collect if needed → Check in (early OK with confirm).

**Departure:** Departures → Check out (Collect still available after).

**Extend / shrink:** Edit dates → Total resets to rack × nights; Paid unchanged → Due or Refund → Collect.

**iCal stub:** Needs details → fill matrix → Confirm.

**OTA refunded:** OTA issues → verify → Cancel sheet.

---

## 13. Non-goals (Phase 1)

Email ingest · payment **gateway** · guest CRM · rate plans · scrape OTA · auto check-in · promise zero double-book · multi-unit group id · reopen terminal stays.

Cash **ledger** (`PaymentMovement`) is **in** — Nest table + `/staff/reservations`; PMS uses the live API.

---

## 14. Build order

| #        | Slice                                                                     |
| -------- | ------------------------------------------------------------------------- |
| 1        | Schema + overlap + enums + sync warning                                   |
| 2        | Staff CRUD + field matrix + money                                         |
| 3        | Calendar read + boards                                                    |
| 4        | Check-in/out/cancel + date/unit PATCH                                     |
| 5        | **iCal export**                                                           |
| 6        | Enrich queues                                                             |
| 7        | **iCal import** + Sync now + warnings                                     |
| Ph1 prod | **Hub** topology when PMS trusted (mesh bootstrap OK until then)          |
| Ph2      | Public book — **hub required** (website + walk-in + OTA share PMS export) |

---

## 15. Decisions locked (was open)

| Topic                        | Decision                                                                                                                                                                                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cancel                       | `FRONT_DESK+`                                                                                                                                                                                                                                                                |
| Mid-stay cancel              | `FRONT_DESK+` with confirm                                                                                                                                                                                                                                                   |
| `UNCONFIRMED` + missing feed | Warn only (same as confirmed)                                                                                                                                                                                                                                                |
| `collectedVia`               | Optional                                                                                                                                                                                                                                                                     |
| Unit vs type-first UX        | **Unit required** on write; Choose picker drills Property → Type → Unit                                                                                                                                                                                                      |
| Stay Total suggestion        | `periodCount ×` matching rack (`defaultPriceIdr` / `monthlyPriceIdr` / `yearlyPriceIdr` via `billingPeriod`); `suggestStayTotalIdr`; Paid = sum(movements), never auto-changed on date/unit/period change; if Paid > Total → Refund (`refundDueIdr`), settle via Collect OUT |
| Cash ledger                  | `PaymentMovement` append-only; Nest `/staff/reservations`; PMS live                                                                                                                                                                                                          |
| Cancel money body            | `refundAmountIdr` (OUT amount) for partial — never “remaining Paid”                                                                                                                                                                                                          |
| Check-in if Due > 0          | Warn, allow                                                                                                                                                                                                                                                                  |
| Collect after checkout       | Only while Due > 0 (IN) or Refund > 0 (OUT); hidden when settled                                                                                                                                                                                                             |
| Collect after cancel         | **No** — disposition is chosen on the Cancel sheet                                                                                                                                                                                                                           |
| `total = 0`                  | Allowed; due 0 counts as settled (`PAID`)                                                                                                                                                                                                                                    |

---

## 16. One-screen summary

```text
Desk always sees: Status · Source · Total/Paid/Balance (Due|Refund) · warnings · cash timeline
Boards on /reservations only (no Check-in page): Arrivals (incl. late-in-window) · In-house · Departures (incl. overdue checkout) · Needs details · OTA issues · Balance due
One primary action per status; Collect sheet (IN/OUT movements) + Cancel sheet everywhere
Unit via Choose (Property → Type → Unit), not a mega Select

Confirm = name + (phone|email) + guests + total   (paid may be 0 → opening IN on create)
Money   = UNPAID | DEPOSIT | PAID | REFUNDED
Paid    = sum(PaymentMovement.signedAmount) — never absolute overwrite as desk path
Total   = periodCount × matching rack on unit/period/count change (override OK; Paid unchanged)
         if Paid > Total → Refund = paid − total (Collect OUT; never silent clamp)
iCal in = UNCONFIRMED; missing/dates on CONFIRMED = warn, human decides
iCal out = Phase 1 export so walk-ins block OTAs

Occupies: UNCONFIRMED, CONFIRMED, CHECKED_IN
Overlap in Postgres. Same domain for Phase 2 web.
```

---

## 17. Inventory doc sync

When implementing, align [`inventory-and-reservation-tables.md`](inventory-and-reservation-tables.md): drop `DRAFT`, add `UNCONFIRMED`, money columns, `icalSyncWarning`, occupying set, export note.
