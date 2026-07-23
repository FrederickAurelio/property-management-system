# Dashboard page (staff PMS)

Locked product + UX for `/` (home). Parent domain (statuses, money, boards, iCal): [`reservations-design.md`](reservations-design.md). Spatial view: [`calendar-design.md`](calendar-design.md). Period performance: [`reports-design.md`](reports-design.md).

**Job:** shift triage for one property — **today’s arrivals / departures** plus **exceptions that need ASAP handling**. Same reservation rows as Reservations; different question (“what needs me now?” vs “work the full board”).

Dashboard does **not** replace boards, Calendar, or Reports. Collect / Check-in / Check out / Confirm stay on **detail**. Create stays on Reservations / Calendar — **no New reservation** on Dashboard.

---

## 1. Page purpose

|                  | Dashboard (`/`)                                      | Reservations (`/reservations`)     | Calendar                         | Reports              |
| ---------------- | ---------------------------------------------------- | ---------------------------------- | -------------------------------- | -------------------- |
| Mental model     | Today + exceptions                                   | Full task boards                   | Floor plan over time             | Period performance   |
| Default question | Who’s in/out today, and what’s open-balance / incomplete? | Do Collect / Check-in / enrich     | What’s free?                     | How did we do?       |
| Shape            | Short lists + exception strip                        | Filterable boards                  | Unit × days grid                 | Filters + sections   |
| Money            | Due / Refund **on exception rows only**              | Due column · Balance due board     | Optional Due hint on bar         | Cash in period       |
| Audience         | Front desk (every shift)                             | Front desk                         | Front desk                       | ADMIN+               |

---

## 2. Scope (locked)

| #     | Capability            | One-line                                                                 |
| ----- | --------------------- | ------------------------------------------------------------------------ |
| **1** | Property scope        | One property at a time (same options language as Calendar / Reports)     |
| **2** | Arrivals today        | Short list: check-in window (incl. late) — row → detail                  |
| **3** | Departures today      | Short list: checkout due/overdue — row → detail                          |
| **4** | Needs attention       | Open balance (in-house + after checkout) · stranded CONFIRMED · soon stubs · iCal alerts |
| **5** | Sync all              | One button to enqueue iCal pull now (`FRONT_DESK+`; when iCal ships)     |

**Out of this page (wrong job):**

- New reservation / New block (Reservations · Calendar)
- Full In-house roster (who’s staying with nothing owed) — not triage
- Full Balance due / Needs details / iCal boards (Reservations owns those)
- Collect / Check-in / Check out primary actions on the row (detail owns them)
- “Cash collected today”, occupancy %, period KPIs (Reports)
- All-properties default

---

## 3. Layout

```text
[ Property ▼ ]                         [ Sync all ]
Today · <date>

── Arrivals (n) ──────────────────────────────── View all → board
   late first · then Due · then checkInDate
   guest · unit · Late? · Due?  →  /reservations/:id

── Departures (n) ────────────────────────────── View all → board
   late first · then Due · then checkOutDate
   guest · unit · Late? · Due?  →  /reservations/:id

── Needs attention (n) ───────────────────────── hide when empty
   open balance · stranded CONFIRMED · stubs soon · iCal
   guest · unit · why  →  /reservations/:id
   View all → matching board when truncated
```

| Element        | Rule                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| Property       | Required. Persist last choice like Calendar if that pattern already exists; otherwise default first option. |
| Date           | Always **today** (property-local calendar date — same “today” as boards). No date picker on v1.           |
| Sync all       | Visible `FRONT_DESK+` when iCal worker exists; disabled/toast while a pull is already queued if needed.   |
| New reservation | **Not on this page.**                                                                                   |
| Section counts | Header `(n)` = full matching count for the property (not only the truncated rows shown).                  |
| Row click      | Navigate to reservation detail — same as Calendar stay bar and Reservations list.                         |
| View all       | Deep-link `/reservations?board=…` (and property query if boards support it).                              |

**Quiet day:** empty Arrivals / Departures and empty Needs attention is success — do not invent filler cards.

---

## 4. Section filters

Reuse board semantics from [`reservations-design.md`](reservations-design.md) §3.1 so counts match when staff open “View all”.

### 4.1 Arrivals

| Rule        | Value                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------- |
| Filter      | `status = CONFIRMED` and `checkInDate ≤ today < checkOutDate` (includes overdue / late arrival) |
| Sort        | Late first · then Due > 0 · then `checkInDate` asc · then guest                                |
| Row signals | Late arrival badge · Due / Refund when open money ≠ settled                                    |
| Cap         | Show up to **8** rows; else truncate + View all → Arrivals board                               |

### 4.2 Departures

| Rule        | Value                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------- |
| Filter      | `status = CHECKED_IN` and `checkOutDate ≤ today` (includes overdue / late departure)     |
| Sort        | Late first · then Due > 0 · then `checkOutDate` asc · then guest                         |
| Row signals | Late departure badge · Due / Refund when open money ≠ settled                            |
| Cap         | Show up to **8** rows; else truncate + View all → Departures board                       |

Do **not** list full In-house on Dashboard. Guests staying past today with nothing to chase are not shift triage.

### 4.3 Needs attention

One strip for exceptions that are **not** “expected in/out today” or that need money/enrich/sync handling ASAP. Hide the whole section when count = 0.

**Open balance (locked — same rule as Reservations Balance due board):** Due > 0 **or** Refund > 0 (overpay). Not “unpaid only” — Refund is the same chase.

| Kind                           | Filter                                                                                         | Why it’s here                                                                 | View all board   |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------- |
| **Open balance · in-house**    | `status = CHECKED_IN` and `checkOutDate > today` and open balance                              | Mid-stay Due **or** Refund — not a full house list                            | Balance due      |
| **Open balance · checked out** | `status = CHECKED_OUT` and open balance                                                        | Same money rule after checkout                                                | Balance due      |
| **Stranded CONFIRMED**         | `status = CONFIRMED` and `checkOutDate ≤ today`                                                | Never checked in; fell off Arrivals; still occupies calendar → Cancel / no-show | All (no board) |
| **Needs details (soon)**       | `status = UNCONFIRMED` and `checkInDate ≤ today + 1 day` (today or tomorrow, property-local) | Stub about to arrive — enrich before they show                                | Needs details    |
| **iCal alerts**                | `icalSyncWarning IS NOT NULL`                                                                  | Feed cancel / date drift — urgent if in-house                                 | iCal alerts      |

In-house and post-checkout money rows get **identical** open-balance treatment (Due chip and/or Refund chip). Only status differs.

**Stranded CONFIRMED:** same rule as reservations-design (“past `checkOutDate` without ever checking in → Cancel”). No separate `NO_SHOW` status — chip **Cancel / no-show**; row → detail → Cancel sheet. These are **not** on Arrivals once `today >= checkOutDate`, so Dashboard is the place they stay visible.

**Sort (locked):** stranded CONFIRMED first (oldest `checkOutDate` first — unit still blocked) · then open-balance rows — prefer **highest open amount** (max(Due, Refund)), then `CHECKED_OUT` before mid-stay `CHECKED_IN`, then guest · then Needs details by `checkInDate` asc · then iCal alerts (`CHECKED_IN` warnings before others).

**Dedup:** a row appears **once**. If a stay matches multiple kinds (e.g. open-balance in-house + iCal warning), show **one** row with combined signals (Due/Refund + warning), still link to detail. Stranded CONFIRMED cannot also be Arrivals (window closed).

**Cap:** up to **8** rows; truncate + prefer linking View all to Balance due when money rows dominate, else Needs details / iCal alerts as appropriate — or a single “View on Reservations” that lands on Balance due if unsure. Prefer honest deep-links per dominant kind when easy. Stranded rows: View all → `/reservations` (All / default list) filtered if/when FE supports; otherwise detail-only is enough for low counts.

**Not in Needs attention:**

- Full In-house with settled money (Due = 0 and Refund = 0) — no job
- Today’s arrivals/departures already listed above (even with open balance — Due/Refund badge lives on those rows; do not duplicate into Needs attention)
- Period cash / “collected today”

---

## 5. Row content (all sections)

| Field        | Rule                                                                 |
| ------------ | -------------------------------------------------------------------- |
| Guest        | Name; stub → “Needs details” / source label (same as list language)  |
| Unit         | Unit label (+ type muted optional)                                   |
| Badges       | Late arrival / Late departure · Due · Refund · iCal warning          |
| Why (Needs)  | Short reason chip: `Due` · `Refund` · `Cancel / no-show` · `Needs details` · `iCal` |
| Primary click| Entire row → `/reservations/:id`                                     |
| Actions      | **None** on the row — no Collect / Check-in buttons on Dashboard     |

Money on Dashboard is a **signal**, not a Collect surface. Same Due/Refund math as elsewhere (Paid = sum of movements).

---

## 6. Roles

| Action                         | `FRONT_DESK` | `ADMIN` / `SUPER_ADMIN` |
| ------------------------------ | ------------ | ----------------------- |
| View Dashboard                 | Yes          | Yes                     |
| Sync all                       | Yes          | Yes                     |
| Open detail / boards from links| Yes          | Yes                     |

No ADMIN-only gate (unlike Reports). This is the desk home screen.

---

## 7. API (intent)

Prefer **one** staff aggregate for the page so PMS does not fan out six board queries.

Suggested shape (names flexible; keep in `domain/` + `/staff/...`):

```text
GET /staff/properties/:propertyId/dashboard?date=today
  → {
      date,
      arrivals: { total, items: StaffReservationListItem[] },
      departures: { total, items: … },
      needsAttention: { total, items: … }  // each item may include attentionKinds[]
    }
```

| Rule            | Detail                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| Auth            | Session + `FRONT_DESK+`                                                |
| Property        | Path or required query — one property                                  |
| `date`          | Default today; server uses same property-local “today” as boards       |
| List items      | Slim list shape (same as reservation boards) — not full detail         |
| Truncation      | Server may return capped `items` + honest `total`, or return all and let FE cap — pick one and document in OpenAPI when implementing |
| Sync all        | Existing / planned iCal enqueue endpoint — button only; not part of GET body |

PMS: TanStack Query key includes `propertyId` (+ date if ever non-today). Invalidate with reservation / iCal mutations that can change membership (same spirit as board invalidation).

---

## 8. Empty / edge states

| Case                         | UI                                                              |
| ---------------------------- | --------------------------------------------------------------- |
| No property selected         | Prompt to pick property (same as Calendar)                      |
| No arrivals                  | Section header + short empty line (“No arrivals today”)         |
| No departures                | Same                                                            |
| Needs attention empty        | **Hide** the section                                            |
| Sync all unavailable         | Hide button until iCal ships; do not show a dead control        |
| Sync in progress / queued    | Disable button or show brief status — no fake “100% synced”     |

---

## 9. Relationship to other surfaces

| Surface                | Owns                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| `/` Dashboard          | Today arrivals/departures triage · Needs attention exceptions · Sync all |
| `/reservations` boards | Full Arrivals · Departures · In-house · Balance due · Needs details · iCal |
| `/reservations/:id`    | Collect · Check-in / out · Confirm · Cancel                          |
| `/calendar`            | Spatial busy/free · create reservation / block                       |
| `/reports`             | Period cash · occupancy · source · compare · CSV                     |

---

## 10. Acceptance checklist

- [ ] One property required; date = today
- [ ] No New reservation (or New block) on Dashboard
- [ ] Arrivals / Departures filters match Reservations boards (incl. late)
- [ ] No full In-house list; mid-stay open balance (Due **or** Refund) under Needs attention
- [ ] Needs attention treats CHECKED_OUT open balance the same (Due **or** Refund)
- [ ] Needs attention includes stranded `CONFIRMED` with `checkOutDate ≤ today` (Cancel / no-show)
- [ ] Today’s arrivals/departures with Due are **not** duplicated into Needs attention
- [ ] Row click → detail; no Collect / Check-in on rows
- [ ] Needs attention hidden when empty
- [ ] Sync all on Dashboard when iCal exists (`FRONT_DESK+`)
- [ ] No cash-today KPI / occupancy / Reports widgets
- [ ] FRONT_DESK can open the page

---

## 11. References

| Doc                                                                          | Role                                      |
| ---------------------------------------------------------------------------- | ----------------------------------------- |
| [`reservations-design.md`](reservations-design.md)                           | Boards, Due/Refund, Late, iCal warnings   |
| [`calendar-design.md`](calendar-design.md)                                   | Property scope, click → detail            |
| [`reports-design.md`](reports-design.md)                                     | Not period KPIs                           |
| [`inventory-and-reservation-tables.md`](inventory-and-reservation-tables.md) | Tables                                    |
| [`.docs/cabin-pms-client-plan.md`](../.docs/cabin-pms-client-plan.md)        | Product brief                             |
