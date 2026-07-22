# Reservations design (production PMS)

**Status:** locked design intent — align before Prisma / API / PMS.  
**Depends on:** [`inventory-and-reservation-tables.md`](inventory-and-reservation-tables.md)  
**Product:** [`.docs/cabin-pms-client-plan.md`](../.docs/cabin-pms-client-plan.md)

---

## 0. Phase framing

Business **already runs**: Booking.com · Airbnb · Agoda · manual / walk-in / WhatsApp. Phase 1 PMS must be **prod** for that — not a demo until the website ships.

| Phase | Is | Is not |
|-------|-----|--------|
| **1** | Staff PMS: calendar, reservations, money/DP, check-in/out, reports, **iCal export + import** | Waiting on `apps/web`; **no** email ingest |
| **2** | Customer book FE → **same** `Reservation` / `domain/` (`source=WEBSITE`) | “When money/bookings start” |

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

| Question | UI |
|----------|-----|
| Which unit / nights? | Unit code + date range |
| Ops where? | Status badge |
| From where? | Source badge |
| Money? | **Total · Paid · Due** (never hide) |
| Needs human? | `UNCONFIRMED` and/or `icalSyncWarning` |

**Invariant:** reservation always has `unitId`. Type-then-assign is UX only; write path always stores a unit.

**Unit field UX (PMS):** label + **Choose** → inventory drill-down (Property → Unit type → Unit) → **Confirm**. Not a Select of all units. Active units only; no CRUD in the picker. Edit / already chosen opens on the unit’s layer; create with board `propertyId` starts on unit types.

```text
Unit ── Reservation   (guest stay / iCal stub)
    └── CalendarBlock (maintenance, owner, soft HOLD — not OTA busy)
```

---

## 2. Three axes (never mix)

| Axis | Fields | Meaning |
|------|--------|---------|
| Channel | `source` | MANUAL · WEBSITE · BOOKING_COM · AIRBNB · AGODA |
| Ops | `status` | Lifecycle on the property |
| Money | `totalAmountIdr`, `paidAmountIdr` (sum of movements), `paymentStatus`, movements | Quote / received / due·refund |

`CONFIRMED` ≠ paid. Money is independent so desk can have `CONFIRMED + DEPOSIT` or `CHECKED_IN + UNPAID`.

---

## 3. Front desk operating model (predictable UX)

### 3.1 Daily boards (same filters everywhere)

Phase 1 desk boards live on **Reservations** (`/reservations`) only — **no** separate Check-in page. Check-in / check-out actions run from list → detail (and later calendar).

| Board | Default filter | Primary job |
|-------|----------------|-------------|
| **Arrivals** | `status = CONFIRMED` and `checkInDate ≤ today < checkOutDate` (includes overdue) | Collect due → Check in |
| **In-house** | `status = CHECKED_IN` | Extend / collect / Check out |
| **Balance due** | Due > 0 **or** Refund > 0 (overpay), status occupying **or** `CHECKED_OUT` | Collect / Refund |
| **Departures** | `status = CHECKED_IN` and `checkOutDate ≤ today` (includes overdue) | Check out |
| **Needs details** | `status = UNCONFIRMED` | Enrich → Confirm |
| **iCal alerts** | `icalSyncWarning IS NOT NULL` | Verify cancel / date drift |

Arrivals matches the check-in window; Departures matches due/overdue checkout (not “today only”). Sort Arrivals by `checkInDate` asc, Departures by `checkOutDate` asc (oldest overdue first). PMS shows **Late arrival** / **Late departure** badges on list + detail wherever the row appears (not only on those boards). Past `checkOutDate` without ever checking in → find under All → **Cancel** (no-show notes); no separate `NO_SHOW` status.

Calendar is the spatial view of the same rows — same badges, same click-through to detail. Full page spec: [`calendar-design.md`](calendar-design.md).

### 3.2 One detail page — primary actions by status

Only **one primary button** (filled). Everything else secondary. Money block always on the right/top.

| Status | Primary | Secondary |
|--------|---------|-----------|
| `UNCONFIRMED` | **Confirm** (opens enrich form if incomplete) | Cancel · Edit dates/unit |
| `CONFIRMED` | **Check in** (if `checkInDate <= today`) | Collect / Refund · Edit · Cancel |
| `CHECKED_IN` | **Check out** (if `checkOutDate <= today` **or** early OK) | Collect · Edit dates · Cancel (confirm) |
| `CHECKED_OUT` | — | **Collect** only if Due > 0 · **Refund** only if overpaid · hidden when settled · no Edit / reopen |
| `CANCELLED` | — | Money closed at Cancel sheet · no Collect · no Edit / reopen |

**Predictability rules**

1. Same action names on calendar popover, list row, and detail.
2. Illegal actions are **hidden**, not error-after-click (BE still enforces).
3. Any cash action uses the **same Collect sheet** (amount → posts `PaymentMovement`; Paid = sum).
4. Cancel always uses the **same Cancel sheet**: reason/notes optional + money disposition if `paid > 0`.
5. Warnings (`icalSyncWarning`, balance due) use one banner pattern — never a different modal language per screen.

### 3.3 Roles (locked for Phase 1)

| Action | `FRONT_DESK` | `ADMIN` / `SUPER_ADMIN` |
|--------|--------------|-------------------------|
| Create / edit / confirm / check-in / out | Yes | Yes |
| Collect / refund via movements | Yes | Yes |
| Cancel | Yes | Yes |
| Mid-stay cancel (`CHECKED_IN` → `CANCELLED`) | Yes + confirm dialog | Yes |
| Delete reservation hard | **No** | **No** (cancel only) |
| iCal feed URL settings | No | Yes |

---

## 4. How bookings enter

| Channel | Create as | Occupies? | Money at create |
|---------|-----------|-----------|-----------------|
| Manual / walk-in / WA | `CONFIRMED` | Yes | Staff: total + paid (0 / DP / full) |
| OTA typed by hand (extranet open) | `CONFIRMED` | Yes | Staff from extranet |
| iCal pull | `UNCONFIRMED` | Yes | Unknown |
| Website (Phase 2) | `CONFIRMED` | Yes | Checkout |

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

| Action | Allowed when |
|--------|----------------|
| Check in | `status=CONFIRMED` and `checkInDate <= today < checkOutDate` |
| Early check-in (before `checkInDate`) | Allowed with confirm (“early?”) — `FRONT_DESK+` |
| Check out | `status=CHECKED_IN` and `today <= checkOutDate` **or** early checkout confirm |
| Late checkout (after `checkOutDate`) | Still allow check out + note; unit already free for overlap from `checkOutDate` |

Timestamps: `confirmedAt`, `checkedInAt`, `checkedOutAt`, `cancelledAt`.

**No separate `NO_SHOW` status.** Guest never arrived → **Cancel** (same sheet / money disposition); optional notes e.g. “no-show”.

---

## 6. Money

Desk meaning of `paymentStatus`: **“what does the guest still owe at the property?”** — not bank reconciliation to a gateway.

**Locked model:** quote vs cash are separate.

| Concept | Storage | Changed by |
|---------|---------|------------|
| **Quote** | `Reservation.totalAmountIdr` | Edit stay / create form |
| **Cash** | Append-only `PaymentMovement` rows | Collect (IN/OUT), Cancel refund, create opening DP |
| **Paid** | `Reservation.paidAmountIdr` | **Denormalized cache** = `sum(movements.signedAmount)` — never overwrite alone |
| **Balance** | Derived | Due = max(total − paid, 0); Refund = max(paid − total, 0) |

```text
UNPAID    paid = 0
DEPOSIT   0 < paid < total   (total required)
PAID      paid >= total      (total required; includes overpay → Due = 0, Refund > 0)
REFUNDED  explicit after cancel full-refund (or paid driven to 0 on cancel path)
```

| Reservation column | Null | Notes |
|--------------------|------|--------|
| `totalAmountIdr` | yes until confirm | Whole IDR; **0 allowed** (complimentary) |
| `paidAmountIdr` | no, default 0 | Cache from movements |
| `paymentStatus` | no | Recomputed from total vs paid (except force `REFUNDED`) |
| `collectedVia` | yes | Optional rollup: latest movement method |

### `PaymentMovement` (cash ledger)

| Column | Notes |
|--------|--------|
| `id` / `reservationId` | |
| `direction` | `IN` \| `OUT` |
| `kind` | `DEPOSIT` \| `TOP_UP` \| `REFUND` \| `CANCEL_REFUND` \| `CHANNEL_SETTLED` |
| `amountIdr` | always `> 0` |
| `signedAmount` | `+amount` (IN) or `−amount` (OUT) |
| `method` | `PROPERTY` \| `CHANNEL` \| `MIXED` \| null |
| `note` | optional |
| `createdAt` / `createdByAdminId` | audit — who posted cash; no full edit history table in Phase 1 |

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

| Intent | Input | Result |
|--------|-------|--------|
| Collect DP / top-up | amount ≤ Due, method, note | Movement `IN` (`DEPOSIT` / `TOP_UP` / `CHANNEL_SETTLED`) |
| Collect full Due | shortcut amount = Due | Same IN |
| Refund excess | amount ≤ Refund | Movement `OUT` (`REFUND`) |
| Refund full excess | shortcut amount = Refund | Same OUT |

Do **not** expose absolute Paid rewrite as the desk path.

### OTA money (simple rule)

| Case | Do this |
|------|---------|
| Pay at property | total from extranet; leave `UNPAID` until Collect IN |
| Already paid on Airbnb/Booking | total + Collect full Due with `CHANNEL` / `CHANNEL_SETTLED` |
| iCal stub | leave null total until Confirm |

### Cancel + money (one Cancel sheet)

If `paid == 0`: cancel → `CANCELLED` + `UNPAID`.  
If `paid > 0`: staff **must** pick:

| Choice | Effect |
|--------|--------|
| Full refund | OUT `CANCEL_REFUND` for full Paid → paid 0, `REFUNDED`, then `CANCELLED` |
| Keep payment (no refund) | no movement; amounts stay; `CANCELLED` |
| Partial refund | Body `refundAmountIdr` (amount returned to guest) → OUT that amount; property keeps the rest |

Cancel `POST` body when paid > 0: `{ disposition, refundAmountIdr?, notes? }` — never send “remaining Paid”; cash is always a movement amount.

### Extend / shrink dates

Staff **PATCH dates** (overlap checked).

**Locked Total suggestion (FE = BE later):**

```text
suggestedTotal = nights × UnitType.defaultPriceIdr
```

| Trigger | Total | Paid / movements |
|---------|-------|------------------|
| Create with unit + dates | Fill suggested | Opening `depositAmountIdr` > 0 → first IN `DEPOSIT` |
| Unit type or nights change | Set to suggested | **Never change Paid / movements** |
| Open edit (no night/type change) | Keep saved Total | Keep Paid |
| Staff edits Total by hand | Keep override | Paid stays; if `paid > total` → **Refund** until Collect OUT |

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

| Field | `UNCONFIRMED` | `CONFIRMED`+ |
|-------|---------------|--------------|
| unit + dates | Required | Required |
| `guestName` | Placeholder OK | **Real name** (reject `*(iCal)` suffix) |
| phone **or** email | Optional | **Required (one of)** |
| `guestCount` | Optional | `>= 1` and `<= maxGuests` |
| `totalAmountIdr` | Optional null | **Required `>= 0`** |
| `paidAmountIdr` | 0 | `>= 0` |

Confirm and manual-create-as-`CONFIRMED` use the same matrix.  
Check-in: **warn** if Due > 0 — do not hard-block.  
Check-out: same — allow with Due > 0; **Collect** remains available after `CHECKED_OUT`.  
Early/late check-out: dates unchanged unless staff **Edit** first; iCal busy follows occupying status (not a manual calendar open).

---

## 8. Table sketch: `Reservation`

| Column | Null | Notes |
|--------|------|--------|
| `id` | no | cuid |
| `propertyId` / `unitId` / `unitTypeId` | no | type snapshot at create |
| `source` / `status` | no | |
| `checkInDate` / `checkOutDate` | no | inclusive / exclusive |
| `guestName` | no | |
| `guestEmail` / `guestPhone` | yes | one required when confirmed |
| `guestCount` | yes | required when confirmed |
| `notes` | yes | |
| `totalAmountIdr` | yes | |
| `paidAmountIdr` | no | default 0; **cache** = sum(`PaymentMovement.signedAmount`) |
| `paymentStatus` | no | |
| `collectedVia` | yes | optional rollup |
| `externalRef` | yes | OTA id or iCal UID |
| `icalSyncWarning` | yes | `MISSING_FROM_FEED` \| `DATES_DIFFER` |
| `icalSyncWarnedAt` | yes | |
| lifecycle timestamps | yes | |
| `createdByAdminId` / `updatedByAdminId` | yes | |

### `PaymentMovement`

| Column | Null | Notes |
|--------|------|--------|
| `id` / `reservationId` | no | |
| `direction` | no | `IN` \| `OUT` |
| `kind` | no | `DEPOSIT` \| `TOP_UP` \| `REFUND` \| `CANCEL_REFUND` \| `CHANNEL_SETTLED` |
| `amountIdr` | no | > 0 |
| `signedAmount` | no | +/− amount |
| `method` | yes | `PROPERTY` \| `CHANNEL` \| `MIXED` |
| `note` | yes | |
| `createdAt` / `createdByAdminId` | | |

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

Optional: one “Sync all” (dashboard / calendar page)
  → FRONT_DESK+ can force a full pull now
```

| Direction | Stored where | How many | UI |
|-----------|--------------|----------|-----|
| **Export** (PMS → OTA) | `Unit.icalExportToken` → public `.ics` URL | **One** per unit | Auto on create · **Copy** (paste into each OTA import) |
| **Import** (OTA → PMS) | `UnitIcalFeed.importUrl` + `source` | **Multiple** (`UNIQUE(unitId, source)`) | Fields on **Create / Edit unit** (or same dialog section) |

Yes: multiple OTA imports per unit.  
No: per-unit “Sync now” on that form — sync is **automatic** via worker. Staff may use **one global Sync all**.

### Table: `UnitIcalFeed` (import)

| Column | Type | Null | Notes |
|--------|------|------|--------|
| `id` | cuid PK | no | |
| `unitId` | FK → Unit | no | `ON DELETE CASCADE` |
| `source` | enum | no | `BOOKING_COM` \| `AIRBNB` \| `AGODA` |
| `importUrl` | `varchar(2048)` | no | OTA calendar **export** URL staff paste |
| `isActive` | boolean | no | default true |
| `lastPulledAt` / `lastSuccessAt` | timestamptz | yes | Worker updates |
| `lastError` | text | yes | |
| `createdAt` / `updatedAt` | timestamptz | no | |

**Constraints:** `UNIQUE (unitId, source)`.  
**Who edits URLs:** `ADMIN+` on unit create/edit. Front desk uses Sync all + enrich queues; does not need to edit URLs daily.

### Unit form UX (Create / Edit)

Same modal/page as unit identity is OK for this slice:

1. **PMS export link** — read-only + Copy (always present after create).  
2. **OTA imports** — up to one URL per source (Booking / Airbnb / Agoda); empty = not connected.  
3. **No Sync button here.**

Optional later: move the block to a “Calendars” tab if the form feels crowded — data model stays the same.

### Automatic sync (worker)

- Cron (e.g. every 5–15 min) pulls every `isActive` feed.  
- **Sync all** (one button on `/calendar` or dashboard): enqueue the same pull job now.  
- Failures → `lastError` on that feed; UI can show a small status under the URL on edit.

### Import pull behavior

Match `(source, externalRef=uid)` → insert `UNCONFIRMED` or update; never clobber enriched guest/money on `CONFIRMED+`.

### UID disappeared

**No new ops status.** Set `icalSyncWarning = MISSING_FROM_FEED`.

| Local status | Auto | Staff |
|--------------|------|--------|
| `UNCONFIRMED` | Warn (not auto-cancel) | Cancel if verified gone |
| `CONFIRMED` | Warn only | Verify OTA → Cancel sheet + money |
| `CHECKED_IN` | Warn + urgent | Investigate — never auto-cancel |
| Terminal | Ignore | — |

UID returns → clear warning.  
`DATES_DIFFER` on `CONFIRMED+` → Accept (apply + revisit money) or Dismiss/Keep.

### Export URL (PMS → OTA)

`GET /public/ical/units/:unitId.ics?token=…` — busy ranges only (occupying reservations + blocks). No PII.  
Staff copy once → paste into each OTA’s **import** calendar. Rotate token = ADMIN (invalidates old link).

---

## 10. Edge-case catalog (prod)

| # | Situation | Expected behavior |
|---|-----------|-------------------|
| 1 | Save overlaps occupying stay/block | **409** `CONFLICT`; FE shows who conflicts (guest/source/dates) |
| 2 | iCal stub exists; staff creates manual same unit/dates | Overlap 409 — open stub and Confirm instead |
| 3 | Two OTA feeds mark same nights (mesh delay double-book) | Second insert 409 or lands on other unit; desk resolves: cancel one, maybe `CalendarBlock` |
| 4 | Walk-in while export not yet pulled by OTA | Known delay window; SOP refresh OTA if last-minute |
| 5 | Guest paid Airbnb; Due would confuse check-in | Mark paid (+ optional CHANNEL) so Due = 0 |
| 6 | Complimentary / owner friend | `total = 0`, Mark paid or leave `PAID` with paid 0→ treat `total=0` and `paid=0` as `PAID` (due 0) |
| 7 | Overpay `paid > total` | `PAID`, Due = 0 |
| 8 | Extend after full pay | Raise total → Due appears; Collect IN top-up |
| 9 | Shrink after full pay | Lower total; Paid stays; Refund = paid − total; Collect OUT |
| 10 | Move to another unit | PATCH `unitId` if free for range; keep money/guest |
| 11 | Unit set `MAINTENANCE` with future stays | Allow unit status change with **warning** listing future occupying rows — do not auto-cancel |
| 12 | Early check-in / early check-out | Allowed with confirm; dates unchanged unless staff edits |
| 13 | Guest never arrived | Cancel (notes optional) → frees unit; money via Cancel sheet if paid |
| 14 | Cancel after DP / full pay | Cancel sheet forces refund disposition |
| 15 | OTA cancel (UID gone) after Confirm | Warning queue → human Cancel + money |
| 16 | OTA date change after Confirm | `DATES_DIFFER` → Accept/Keep |
| 17 | Re-pull after staff cancelled; same UID returns | Do **not** revive cancelled row; new event with same UID → if unique constraint hits, leave cancelled and surface alert “UID reused” for ADMIN |
| 18 | iCal SUMMARY looks like a person | May seed `guestName`; Confirm still requires contact + total |
| 19 | Same-day turnaround | Exclusive checkout: morning out / evening in OK on same date |
| 20 | Check-in with Due > 0 | Warn + allow (pay-at-property) |
| 21 | Edit guest after check-in | Allowed (typos); money/dates separate |
| 22 | Multi-property | All boards scoped by selected `propertyId` |
| 23 | Sync now fails | Keep last good data; show feed `lastError` on unit settings |
| 24 | Export token leaked | Rotate token on unit/feed settings (ADMIN) |

---

## 11. Backend shape

```text
domain/reservations|calendar-blocks|availability
staff/reservations|calendar|calendar-blocks
public/ical (+ Phase 2 book)
```

| Method | Path | Notes |
|--------|------|--------|
| `GET/POST` | `/staff/reservations` | Filters: property, status, source, dates, warning, q |
| `GET/PATCH` | `/staff/reservations/:id` | |
| `POST` | `.../confirm` | Matrix §7 |
| `POST` | `.../check-in` \| `check-out` | |
| `POST` | `.../cancel` | Body: `disposition` + optional `refundAmountIdr` (partial) + `notes` — cash = movement OUT, never remaining-Paid rewrite |
| `POST` | `.../payments` (or `.../movements`) | Body: `direction` · `kind` · `amountIdr` · `method?` · `note?` — Paid = sum |
| `PATCH` | `.../` (total quote only) | Total on reservation; do not PATCH absolute Paid |
| `POST` | `.../accept-ical-dates` \| `dismiss-ical-warning` | |
| `GET` | `/staff/properties/:propertyId/calendar` | |
| CRUD | `/staff/calendar-blocks` | |
| `GET` | `/public/ical/units/:unitId.ics` | tokenized export |

---

## 12. Happy-path flows (desk)

**Walk-in:** Choose unit → dates → Total auto `nights × rack` (staff may override) + paid → guest + contact → Save `CONFIRMED` → (export blocks OTA on delay).

**Arrival:** Arrivals board → see Due → Collect if needed → Check in (early OK with confirm).

**Departure:** Departures → Check out (Collect still available after).

**Extend / shrink:** Edit dates → Total resets to rack × nights; Paid unchanged → Due or Refund → Collect.

**iCal stub:** Needs details → fill matrix → Confirm.

**OTA refunded:** iCal alerts → verify → Cancel sheet.

---

## 13. Non-goals (Phase 1)

Email ingest · payment **gateway** · guest CRM · rate plans · scrape OTA · auto check-in · promise zero double-book · multi-unit group id · reopen terminal stays.

Cash **ledger** (`PaymentMovement`) is **in** — Nest table + `/staff/reservations`; PMS uses the live API.

---

## 14. Build order

| # | Slice |
|---|--------|
| 1 | Schema + overlap + enums + sync warning |
| 2 | Staff CRUD + field matrix + money |
| 3 | Calendar read + boards |
| 4 | Check-in/out/cancel + date/unit PATCH |
| 5 | **iCal export** |
| 6 | Enrich queues |
| 7 | **iCal import** + Sync now + warnings |
| Ph2 | Public book + hub preference |

---

## 15. Decisions locked (was open)

| Topic | Decision |
|-------|----------|
| Cancel | `FRONT_DESK+` |
| Mid-stay cancel | `FRONT_DESK+` with confirm |
| `UNCONFIRMED` + missing feed | Warn only (same as confirmed) |
| `collectedVia` | Optional |
| Unit vs type-first UX | **Unit required** on write; Choose picker drills Property → Type → Unit |
| Stay Total suggestion | `nights × UnitType.defaultPriceIdr` (`suggestStayTotalIdr`); Paid = sum(movements), never auto-changed on date/unit change; if Paid > Total → Refund (`refundDueIdr`), settle via Collect OUT |
| Cash ledger | `PaymentMovement` append-only; Nest `/staff/reservations`; PMS live |
| Cancel money body | `refundAmountIdr` (OUT amount) for partial — never “remaining Paid” |
| Check-in if Due > 0 | Warn, allow |
| Collect after checkout | Only while Due > 0 (IN) or Refund > 0 (OUT); hidden when settled |
| Collect after cancel | **No** — disposition is chosen on the Cancel sheet |
| `total = 0` | Allowed; due 0 counts as settled (`PAID`) |

---

## 16. One-screen summary

```text
Desk always sees: Status · Source · Total/Paid/Balance (Due|Refund) · warnings · cash timeline
Boards on /reservations only (no Check-in page): Arrivals (incl. late-in-window) · In-house · Departures (incl. overdue checkout) · Needs details · iCal alerts · Balance due
One primary action per status; Collect sheet (IN/OUT movements) + Cancel sheet everywhere
Unit via Choose (Property → Type → Unit), not a mega Select

Confirm = name + (phone|email) + guests + total   (paid may be 0 → opening IN on create)
Money   = UNPAID | DEPOSIT | PAID | REFUNDED
Paid    = sum(PaymentMovement.signedAmount) — never absolute overwrite as desk path
Total   = nights × UnitType.defaultPriceIdr on unit/nights change (override OK; Paid unchanged)
         if Paid > Total → Refund = paid − total (Collect OUT; never silent clamp)
iCal in = UNCONFIRMED; missing/dates on CONFIRMED = warn, human decides
iCal out = Phase 1 export so walk-ins block OTAs

Occupies: UNCONFIRMED, CONFIRMED, CHECKED_IN
Overlap in Postgres. Same domain for Phase 2 web.
```

---

## 17. Inventory doc sync

When implementing, align [`inventory-and-reservation-tables.md`](inventory-and-reservation-tables.md): drop `DRAFT`, add `UNCONFIRMED`, money columns, `icalSyncWarning`, occupying set, export note.
