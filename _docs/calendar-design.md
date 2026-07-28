# Calendar page (staff PMS)

Locked UX + product for `/calendar`. Parent domain (statuses, money, overlap, iCal): [`reservations-design.md`](reservations-design.md).

**Job:** spatial busy/free for one property — units × days. Same occupying stays as Reservations; different question (“what’s free?” vs “what do I do next?”).

---

## 1. Page purpose

| | Reservations (`/reservations`) | Calendar (`/calendar`) |
|---|---|---|
| Mental model | Task / board list | Floor plan over time |
| Default question | Who needs action? | Which units are busy or free? |
| Shape | Filterable rows | Unit rows × date columns |
| Money | Total / Paid / Due columns | Optional Due hint on stay bar only |
| Create | Form + Choose unit | Empty range → form prefilled; toolbar New → Choose unit |

Calendar does **not** replace boards. Boards stay on Reservations. Check-in / Collect / Cancel stay on detail (and optional calendar popover with the **same** action names).

---

## 2. Layout (desktop)

```text
[ Property ▼ ]  [ ◀ ]  range label  [ ▶ ]  [ Today ]     [ New reservation ]  [ New block ]

              Mon 21  Tue 22  Wed 23  Thu 24  Fri 25  Sat 26  Sun 27
────────────────────────────────────────────────────────────────────
 Deluxe
   Cabin 01   [==== Budi ==========][======= Sari =======]
   Cabin 02   ··· ··· [==== Andi ========] ··· ··· ···
 Studio
   Cabin 03   [==== UNCONFIRMED (Airbnb) ====] ··· ···
   Cabin 04   ··· ··· ··· ··· ··· ··· ···
```

| Element | Rule |
|---------|------|
| Scope | **One property** at a time (required). Property switcher uses existing property options. |
| Rows | **One row per unit** (bookable inventory). Not one row per unit type. |
| Grouping | Optional **unit-type section headers** (name only) so long lists stay scannable. Units with no type: one “Ungrouped” / flat section. |
| Columns | Calendar days in the visible range. |
| Today | Distinct vertical marker / column highlight. |
| Stay bars | Occupying reservations spanning check-in → check-out (exclusive end night, same as overlap rules). |
| Block bars | `CalendarBlock` spans — visually distinct from stays (e.g. hatched / muted; no guest name). |
| Empty cells | Free nights — clickable / selectable for create. |

**Default range:** **14 days starting today** (desk “next two weeks”). Prev/next **slides by 7 days** (half overlap). **Today** jumps back to the default window anchored on today.

Month toggle is optional later; do not require a full-month grid if 14-day is clearer for desk density.

---

## 3. What appears on the grid

### Occupying stays (from `Reservation`)

Show only statuses that **occupy** the unit calendar:

`UNCONFIRMED` · `CONFIRMED` · `CHECKED_IN`

Hide on the grid: `CHECKED_OUT` · `CANCELLED` (they do not occupy).

| On the bar | Content |
|------------|---------|
| Primary label | Guest name (or “Needs details” / source stub label for thin `UNCONFIRMED`) |
| Secondary | Source cue (tint or small source badge — same language as list) |
| Status | Ops status readable (color and/or tiny badge) — same tones as Reservations |
| Money | Optional compact Due / Refund cue when open money ≠ settled; **no** Total/Paid columns on the grid |
| Late | Late arrival / Late departure badges when applicable (same rules as list) |
| iCal warning | OTA issue affordance when `icalSyncWarning` set (plain-language title on hover) |

Click stay bar → reservation detail (`/reservations/:id`), preserving a way back to calendar (return URL or location state). Same primary/secondary actions as detail; do not invent calendar-only action names.

### Calendar blocks (non-guest busy)

Separate entity — **never** fake a reservation named “Maintenance”.

| Kind | Meaning |
|------|---------|
| `MAINTENANCE` | Closed for work |
| `OWNER` | Owner use |
| `HOLD` | Soft hold (staff) |
| `OTHER` | Misc non-guest |

OTA busy from import = `Reservation` `UNCONFIRMED`, **not** a block.

Blocks:

- Occupy the unit for overlap (same Postgres / transactional rules as stays).
- Draw differently from guest bars (pattern + kind label; no money).
- Click → edit/delete block sheet (not reservation detail).

### Inactive / non-bookable units

Still list units for the property so staff see reality. Dim or badge non-`ACTIVE` / unbookable units; empty-range create on them should follow the same bookability rules as Choose unit / create reservation (block or warn — match existing create behavior).

---

## 4. Interactions

### Navigate

- Change property → reload grid for that property + current range.
- Prev / next / Today → change date window; keep property.
- Optional: filter by unit type (narrow rows). Do **not** filter to a single unit as the default model — the point is scanning many units.

### Open existing stay

- Click bar → detail.
- Optional popover on click/hover with guest, dates, status, Due, and primary action shortcut — same names as detail (`Confirm` / `Check in` / `Check out` / …). Illegal actions hidden.

### Create reservation from empty

1. Click one free cell or drag a free date range on a **unit row**.
2. Open existing reservation create dialog with **unit + check-in/out prefilled**.
3. **Do not** open Choose unit — the cell already chose the unit.
4. Save → same create API; grid refreshes / cache syncs like other reservation writes.

### New reservation (toolbar)

No cell selected → open create dialog **with Choose unit** (same Property → Type → Unit flow as Reservations). Dates default to today / tomorrow or empty per existing form defaults.

### Create / edit calendar block

- Toolbar **New block**, or empty-range action “Block these nights”.
- Sheet: unit (prefilled if from a row), dates, kind, optional note.
- Edit/delete from clicking an existing block bar.
- Overlap conflict → 409 with who conflicts (same honesty as reservation create).

### What the calendar must not do

- Promise zero double-booking from looking at the screen alone.
- Host a second money desk (full Collect ledger lives on detail).
- Use boards (Arrivals, etc.) as calendar tabs — boards stay on `/reservations`.
- Treat unit type as the calendar grain.
- Represent OTA busy as `CalendarBlock`.

---

## 5. Mobile

Staff use phone on the floor. Desktop grid is primary; mobile must still work.

| Concern | Rule |
|---------|------|
| Property + range chrome | Sticky / compact; same controls |
| Grid | Horizontal scroll for days; frozen unit name column |
| Bars | Tappable → detail (same as desktop) |
| Create from empty | Long-press or tap free cell → same prefilled create |
| Density | Prefer fewer days visible at once if needed; do not drop create or open-detail |

Touch targets ≥44px for chrome controls. No decorative-only gestures.

---

## 6. Data & API

### Read

`GET /staff/properties/:propertyId/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`

Returns everything needed to paint the grid in **one** response (or a small fixed set of calls — prefer one aggregate):

- Units for the property (id, code, status, unit type id/name/sort)
- Occupying reservations overlapping `[from, to)` (id, unitId, guest, source, status, dates, payment summary / due cues, late flags, ical warning)
- Calendar blocks overlapping the range (id, unitId, kind, dates, note)

Do not page like the reservations infinite list. Range is bounded by the UI window.

Reuse domain occupancy / overlap rules already used by unit occupancy + create. Wire types live in `@cabin/api-contract`.

### Write

| Action | API |
|--------|-----|
| Create / patch stay | Existing `/staff/reservations` |
| Create / patch / delete block | `/staff/calendar-blocks` CRUD |
| Ops actions from popover | Existing confirm / check-in / check-out / cancel / movements |

Overlap: occupying stays **and** blocks — Postgres / transactional, never UI-only.

### Cache (PMS)

- Query key includes `propertyId` + `from` + `to`.
- After reservation or block writes that change busy nights → invalidate / sync calendar query (same spirit as `occupancyChanged` on reservation sync helpers).

Existing helpers to lean on:

- `GET /staff/units/:id/occupancy` — date picker only; **not** a substitute for the property calendar aggregate.
- `GET /staff/properties/:propertyId/units/availability` — choose-unit / bookability; calendar page still needs the aggregate above.

### FE now / BE later

| Layer | Status |
|-------|--------|
| PMS `/calendar` UI (grid, chrome, bars, create dialog reuse, block sheet) | **Done** |
| Wire types in `@cabin/api-contract` (`StaffPropertyCalendar`, `StaffCalendarBlock`, …) | **Done** |
| Property switcher | Live `GET /staff/properties/options` |
| Create / edit reservation | Live `/staff/reservations` via existing `ReservationFormDialog` |
| Open stay detail + back to calendar | Live detail |
| Calendar aggregate read | Live `GET /staff/properties/:propertyId/calendar` |
| `CalendarBlock` CRUD | Live Prisma + `/staff/calendar-blocks` |
| Empty-range create unit lock | Real Nest unit ids → lock `initialChosen`, skip Choose unit |

**Still optional later:** Sync all, ops popover, month toggle (out of scope for page MVP)

---

## 7. Visual / UX register

- Anchor: Linear-dense / Stripe-data admin (same as rest of PMS). Skills: `shadcn` + `product-ui-design`.
- One composition: toolbar + grid. No marketing hero, no four-cell stat strip, no glowing dots.
- Stay vs block must be distinguishable at a glance without reading every label.
- Source color language should match Reservations list where practical.
- Cancelled/checked-out stays are absent from the grid (not muted rows — they simply don’t occupy).

---

## 8. iCal on this page

When iCal exists:

- Imported OTA stubs appear as `UNCONFIRMED` stay bars (enrich via detail / Needs details board).
- Optional **Sync all** control on calendar chrome (forces PMS pull of feeds — does not refresh OTAs).
- Export copy links stay on unit inventory UI; calendar consumes busy truth, it is not the feed admin.

Until iCal ships, calendar still shows manual stays + blocks.

---

## 9. Must-have checklist (page complete when all true)

- [x] Route `/calendar` is real (not placeholder); nav item works
- [x] Property switcher; default sensible property (last used or first option)
- [x] Unit rows grouped by unit type; one row per unit
- [x] Date window default 14 days from today; prev / next step 7 days; Today resets
- [x] Today column marker
- [x] Occupying reservation bars with guest/source/status cues
- [x] Click bar → reservation detail (back to calendar possible) — live stays
- [x] Empty cell / range → create reservation (dates + unit prefilled when Nest unit on row)
- [x] Toolbar New reservation → create + Choose unit
- [x] CalendarBlock model + CRUD API + bars on grid (kinds above)
- [x] New / edit / delete block from calendar
- [x] Overlap conflicts surface clearly (stay↔stay, stay↔block)
- [x] Non-bookable units visible but create respects bookability
- [x] Mobile usable (scroll + tap detail + create)
- [x] Aggregate calendar GET + PMS query sync after writes
- [x] Same action names as list/detail; no calendar-only verbs
- [x] No boards, no fake maintenance reservations, no second money desk

---

## 10. Out of scope (do not build as part of this page)

- Channel Manager / OTA scraping / remote “Import now” on OTAs
- Rate plans / pricing calendar
- Multi-property single grid
- Drag-and-drop move/resize stays (nice later; Edit dates on detail is enough)
- Guest CRM, email ingest, payment gateway
- Replacing Reservations boards or removing Choose unit from non-prefilled create

---

## 11. Cross-links

| Topic | Doc |
|-------|-----|
| Statuses, boards, money, overlap, iCal feeds | [`reservations-design.md`](reservations-design.md) |
| Product phase framing | [`cabin-pms-client-plan.md`](cabin-pms-client-plan.md) |
| API audience / staff paths | [`../apps/api/AGENTS.md`](../apps/api/AGENTS.md) |
| PMS UI / query rules | [`../apps/pms/AGENTS.md`](../apps/pms/AGENTS.md) |
