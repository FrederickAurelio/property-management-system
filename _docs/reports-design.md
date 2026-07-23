# Reports page (staff PMS)

Locked product + UX for `/reports`. Money and stay rules: [`reservations-design.md`](reservations-design.md). Calendar occupancy nights: [`calendar-design.md`](calendar-design.md).

**Job:** period answers for the **business owner** (and accountant) — cash, fullness, channel mix, compare. Same underlying reservations and movements as the desk; different question (“how did we do?” vs “what do I do next?”).

Reports does **not** replace Reservations boards, Calendar, or Dashboard. Those stay daily ops. Open Due / Refund chase stays on **Reservations** (Balance due board + detail) — not duplicated here.

---

## 1. Page purpose

|                  | Reservations / Calendar / Dashboard                       | Reports (`/reports`)                                   |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| Mental model     | Today’s work                                              | Period performance                                     |
| Default question | Who arrives / what’s free / who’s due?                    | How much cash, how full, which source, vs last period? |
| Shape            | Boards, grid, today strip                                 | Filters + ranked sections + export                     |
| Money            | Per stay Total / Paid / Due · Collect · Balance due board | Cash posted in range (not open-Due chase)              |
| Audience         | Front desk + owner walking the floor                      | Owner review · month-end · Excel                       |

---

## 2. Scope (locked)

All of these ship on `/reports`. No “later” carve-outs in this list — data already exists on `Reservation` / `PaymentMovement` / inventory.

| #     | Capability               | One-line                                                                                             |
| ----- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| **1** | Cash statement           | Cash in / out / net for the period                                                                   |
| **2** | Occupancy                | Property occupied ÷ available unit-nights                                                            |
| **3** | Source mix               | Stays and nights by `Reservation.source` (incl. `WEBSITE`)                                           |
| **4** | Spreadsheet export (CSV) | Download the same numbers / rows for Excel / Sheets / accountant — **not** PDF as primary (see §5.6) |
| **5** | Occupancy by unit type   | Same occupancy math, grouped by type                                                                 |
| **6** | Period compare           | Primary period vs previous equal-length period                                                       |

**Out of this page (wrong job):** daily arrivals/departures lists, open Due/Refund chase lists (Reservations owns that), Collect/Check-in actions, ADR/RevPAR from rack Total, OTA bank payout / commission (not in schema), guest demographics.

---

## 3. Shared filters (controls the whole page)

Every section uses the **same** filter bar. Changing filters recomputes all sections together.

```text
[ Presets: This month | Last month | Last 7 | Last 30 ]
[ Property ▼ ]   [ From ]  [ To ]   [ Compare switch ]   [ Export Excel ]
[ N days · vs previous range ]
```

| Control       | Rule                                                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Presets**   | Quick ranges: month-to-date · last full calendar month · last 7 days · last 30 days (inclusive). Selecting a preset sets From/To.      |
| **Property**  | Required. One property at a time (same language as Calendar). Options from existing property options.                                  |
| **From / To** | Inclusive calendar dates for the **primary** period. Default: **current month to today**.                                              |
| **Compare**   | On by default. Previous period = same length immediately before `From` (e.g. 1–23 Jul → 8–30 Jun). Chrome shows day count + vs window. |
| **Export**    | Spreadsheet/CSV of what the page shows (incl. denser columns + compare). See §5.6. **Not** PDF-first.                                  |

Optional thin filter (not required for v1 layout): **Source** — when set, cash / occupancy narrow to that source; source-mix section still shows all sources (or hide mix when filtered — prefer still show all so mix stays honest).

---

## 4. Page hierarchy (scan order)

Owner opens the page top → bottom. **One screen composition**, not a dashboard of equal cards.

```text
┌─ Filters (presets · property · dates · compare · export) ───────────┐
├─ Header: property name · primary range ─────────────────────────────┤
├─ 1. Cash statement (hero) ──────────────────────────────────────────┤
│     Net (+ prev · Δ · %Δ)  ·  In / Out (+ prev muted)               │
│     Breakdown tables: source → unit type → method · In · Out · Net · % of net │
├─ 2. Occupancy (property) ───────────────────────────────────────────┤
│     %  ·  occupied / available (+ prev nights)  ·  Δ pts            │
├─ 3. Occupancy by unit type ─────────────────────────────────────────┤
│     Table: type (expand → units) · occupied · available · % · Δ%    │
├─ 4. Source mix ─────────────────────────────────────────────────────┤
│     Table: source · stays · nights · % · cash net · % of net        │
│            (+ prev nights · prev % · Δ share · Δ nights)            │
│     Rollup: Direct vs OTA nights + cash net share                   │
└─────────────────────────────────────────────────────────────────────┘
```

| Priority     | Section                | Why this height                                                      |
| ------------ | ---------------------- | -------------------------------------------------------------------- |
| **1 — Hero** | Cash                   | Owner’s first question: money that hit the property ledger           |
| **2**        | Occupancy (property)   | Second question: were we empty or full?                              |
| **3**        | Occupancy by unit type | Same story, product-level — under overall % so hierarchy stays clear |
| **4**        | Source mix             | Channel / website / manual dependency                                |

**Do not** put six equal KPI tiles above the fold. Cash net is the only hero number; everything else supports it or answers the next question.

Honest footer (always visible once):

> Cash = movements posted in PMS for this period. Not OTA payout or bank reconciliation. Occupancy and source use reservation nights in PMS.

---

## 5. Use cases → what matters → why the owner cares

### 5.1 Cash statement

**Use cases**

| Actor              | Situation                          | They need                                 |
| ------------------ | ---------------------------------- | ----------------------------------------- |
| Owner              | End of week / month                | “Berapa uang masuk / keluar di properti?” |
| Owner + accountant | Reconcile to cash / transfer notes | Net + breakdown they can export           |
| Owner              | Staff said they collected DP       | Proof via posted movements, not memory    |
| Owner              | Guest got refund / cancel refund   | See OUT in the same period view           |

**What matters**

| Metric            | Definition                                                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cash in**       | Sum of `PaymentMovement` with `direction=IN` where `createdAt` (date in property TZ / local business date) falls in `[From, To]` and reservation’s unit belongs to the selected property                     |
| **Cash out**      | Same for `direction=OUT`                                                                                                                                                                                     |
| **Net**           | In − Out                                                                                                                                                                                                     |
| **By source**     | Group by parent reservation `source`                                                                                                                                                                         |
| **By unit type**  | Group by reservation unit’s `unitType` (`unitTypeId` null → Ungrouped / Untyped, same language as occupancy-by-type)                                                                                          |
| **By method**     | Group by movement `method` (`PROPERTY` · `CHANNEL` · `MIXED` · null as “Unspecified”)                                                                                                                        |
| **Compare**       | Same metrics for previous period; show absolute delta and optional % delta on Net                                                                                                                            |

**Why**

- Desk Collect posts the truth they already trust for Paid.
- OTAs do not give one combined “property cash” across walk-in + channel settlement lines.
- Quote (`totalAmountIdr`) is **not** shown as revenue here — that confuses cash with promise.

**UI**

- Large **Net** (IDR). Secondary: In · Out; when compare on, muted prev In/Out under that pair.
- Compare on Net: muted previous Net + absolute Δ + % Δ when previous net ≠ 0 (not a second hero).
- Breakdown tables in order **source → unit type → method**: columns **In · Out · Net · % of period Net** (row net ÷ |period net|; same share math as source-mix % of net).
- Same source labels/colors as Reservations list on source breakdown.
- Unit type rows sorted by inventory `sortOrder` (Ungrouped last).

---

### 5.2 Occupancy (property)

**Use cases**

| Actor | Situation              | They need                            |
| ----- | ---------------------- | ------------------------------------ |
| Owner | Month review           | “Bulan ini sepi atau penuh?”         |
| Owner | Pricing / promo talk   | One % to argue from, not gut feel    |
| Owner | Compare to last period | “Better or worse than last stretch?” |

**What matters**

| Metric                    | Definition                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Occupied unit-nights**  | Count of unit×night slots overlapping the period for stays in statuses that **count as business occupancy** (locked below)                              |
| **Available unit-nights** | Active bookable units × nights in period, minus nights closed by `CalendarBlock` (maintenance / owner / hold / other) — so blocks don’t inflate “empty” |
| **Occupancy %**           | occupied ÷ available × 100 (0 if available = 0)                                                                                                         |
| **Compare**               | Previous period % and night counts                                                                                                                      |

**Which stays count as occupied nights**

Include nights from reservations that **occupied or completed** the stay for that night:

- Count nights for: `CONFIRMED` · `CHECKED_IN` · `CHECKED_OUT` (and `UNCONFIRMED` **only if** you treat OTA stubs as real busy — **yes**, same as calendar occupying set for consistency: `UNCONFIRMED` · `CONFIRMED` · `CHECKED_IN`, plus nights already stayed for `CHECKED_OUT` in range).

Locked rule (simple and honest):

- A unit-night is occupied if any reservation with status in  
  `UNCONFIRMED | CONFIRMED | CHECKED_IN | CHECKED_OUT`  
  covers that night (`checkIn ≤ night < checkOut`), **except** `CANCELLED` never counts.
- Cancelled stays never occupy.

**Why**

- Calendar answers “today / next two weeks.” Reports answers “the month.”
- One % stops owner debates without opening every OTA.

**UI**

- One % large enough to scan; subline `occupied / available nights`.
- Compare: previous % + pts Δ; show previous occupied/available on the subline.
- One mute occupancy track under property % is enough — no per-type decorative bars.

---

### 5.3 Occupancy by unit type (expand → units)

**Use cases**

| Actor    | Situation             | They need                                           |
| -------- | --------------------- | --------------------------------------------------- |
| Owner    | One type always empty | Know which product to discount or stop selling hard |
| Owner    | Deluxe always full    | Justify rate or add inventory talk                  |
| Owner    | Type % soft, unclear which room | Expand type → see each unit’s nights / %   |
| Ops lead | Assign promo by type  | Same numbers owner sees                             |

**What matters**

Same formulas as §5.2, **per unit type** (units with no type → one “Ungrouped” row), then **per unit** under that type. Columns: type/unit name · occupied · available · % · when compare: **prev %** · **Δ%**.

Wire: each `StaffReportsOccupancyByUnitType` includes `units: StaffReportsOccupancyByUnit[]` (nested in the summary payload — no second fetch).

**Why**

- Property % hides product mix. Type breakdown is the actionable layer under the hero occupancy.
- Unit drill-down answers “which room is soft?” without a flat wall of every unit by default.

**UI**

- Table directly under property occupancy (not a separate page). Sorted by type `sortOrder` / name.
- Type rows **collapsed by default**; chevron expands indented unit rows (same columns). Expand one or many types independently.
- No charts required; table columns carry compare — not mini progress bars per row.
- CSV: property + type aggregates + unit rows (`unitType`, `unit` columns; empty `unit` = type or property rollup).

---

### 5.4 Source mix

**Use cases**

| Actor | Situation         | They need                                                       |
| ----- | ----------------- | --------------------------------------------------------------- |
| Owner | Channel strategy  | “Terlalu bergantung ke Airbnb?”                                 |
| Owner | Website vs OTA    | Share of `WEBSITE` vs OTAs vs `MANUAL` once website books exist |
| Owner | Walk-in vs online | How much desk / WhatsApp (`MANUAL`) still carries               |

**What matters**

| Metric             | Definition                                                                                                                                                                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stays**          | Count of reservations with `checkIn` in period **or** nights overlapping period — **lock one**. Prefer **nights overlapping period** for mix % (aligns with occupancy); also show **stay count** where `checkIn` in period as a second column for “how many bookings landed.” |
| **Nights**         | Occupied unit-nights in period attributed to that reservation’s `source` (same occupancy night rules as §5.2)                                                                                                                                                                 |
| **% of nights**    | nights ÷ property occupied nights                                                                                                                                                                                                                                             |
| **Sources**        | All `ReservationSource` values: `MANUAL` · `WEBSITE` · `BOOKING_COM` · `AIRBNB` · `AGODA` — show row even if 0 in period so mix is stable                                                                                                                                     |
| **Compare**        | Previous period nights and % per source; show **Δ share (pp)** and Δ nights                                                                                                                                                                                                   |
| **Cash net share** | Same period’s cash-by-source net ÷ |period cash net| — same **% of net** as Cash breakdown tables |

**Why**

- Source is already on every reservation — mix is free and permanent.
- Owner decision is dependency and marketing push; cash-by-source also appears under Cash — **% of net** must match that table.

**UI**

- Table sorted by nights desc (zeros still listed): Source · Stays (check-in in period) · Nights · % nights · Cash net · **% of net** · when compare: Prev nights · Prev % · Δ share · Δ nights.
- Same source labels/colors as Reservations list.
- One rollup line under the table: **Direct (Manual+Website)** vs **OTA** nights % and cash net %.

---

### 5.5 Period compare

**Use cases**

| Actor | Situation           | They need                                    |
| ----- | ------------------- | -------------------------------------------- |
| Owner | “Are we improving?” | Net cash and occupancy vs last equal stretch |
| Owner | Seasonal chat       | Quick Δ without two browser tabs             |

**What matters**

- Compare is **not** its own card. It is a **mode** on Cash, Occupancy, Occupancy-by-type, and Source mix.
- Previous period = equal day-count immediately before primary `From`.
- Show previous value + delta; avoid drowning the primary numbers.

**Why**

- Trend is how owners judge staff and channels. Equal-length periods keep math fair (not “month vs 12 days”).

---

### 5.6 Export — Excel/CSV vs PDF (locked)

**Verdict: spreadsheet (CSV → Excel / Google Sheets) is the primary export. PDF is not the primary product.**

| Job                                     | Better format                                        | Why                                                  |
| --------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| Reconcile cash to bank / kas            | **Excel/CSV**                                        | Sort, filter, add columns, match rows to transfers   |
| Accountant / bookkeeper                 | **Excel/CSV**                                        | They already work in sheets; PDF becomes re-typed    |
| Source / occupancy tables               | **Excel/CSV**                                        | Pivot / chart in their own tool if they want         |
| Open Due / Refund chase                 | Reservations board (+ optional list CSV later there) | Ops chase — not period performance                   |
| “Pretty pack for WhatsApp / print once” | PDF _or_ browser Print                               | Read-only snapshot; nice, not how money work happens |
| Legal / tax filing packet               | Often PDF _from_ their accountant’s process          | Not something PMS must generate first                |

**Why PDF loses as the main export for this PMS**

- Reports here are **working numbers** (cash lines, occupancy / source tables), not a finished annual brochure.
- PDF locks layout; owners then screenshot or re-type into Excel anyway.
- Good multi-section PDF (IDR, tables, compare, page breaks) costs more to build and maintain than CSV for the same data.
- On-screen `/reports` already is the readable “report.” Export’s job is **take the data elsewhere**.

**Optional (not instead of CSV)**

| Affordance                                  | Role                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| Browser **Print** / print CSS on `/reports` | Cheap “PDF” when someone wants a fixed snapshot — no server PDF engine required |
| True **Download PDF** button                | Only if owners repeatedly ask after CSV ships; still secondary to spreadsheet   |

**What ships (locked)**

Export **matches on-screen filters** (property + primary period + compare columns where shown). Deliver as **CSV** (one zip of named files, or one multi-section download set) that opens cleanly in Excel / Sheets:

| File / sheet                        | Contents                                                    |
| ----------------------------------- | ----------------------------------------------------------- |
| `cash-summary`                      | Net, in, out; prev + deltas when compare                    |
| `cash-by-source` / `cash-by-unit-type` / `cash-by-method` | In, out, net, % of net (sheet order matches UI) |
| `occupancy`                         | Property + by type + per-unit rows (`unitType`/`unit`) + compare cols |
| `source-mix`                        | Stays / nights / % / cash net share + compare share columns |

**UI**

- One **Export** control in the filter bar → spreadsheet/CSV (label can say “Export Excel” in UI copy if clearer for non-technical owners; file format remains CSV or `.xlsx` if you add a library — CSV is enough).
- Do **not** lead with PDF. Print via browser is enough for snapshot sharing until proven otherwise.

---

## 6. What not to show (and why)

| Temptation                   | Why not on Reports                                       |
| ---------------------------- | -------------------------------------------------------- |
| Arrivals / departures tables | Duplicate boards; daily ops                              |
| Total quote as “Revenue”     | Quote ≠ cash; misleads owner                             |
| ADR / RevPAR                 | Needs trustworthy sold rate; rack suggestion ≠ OTA price |
| OTA payout / commission      | Not stored; don’t invent                                 |
| Collect / check-in buttons   | Act on reservation detail                                |
| Equal-weight KPI wall        | Breaks hierarchy; cash must lead                         |

---

## 7. Roles (locked)

There is no separate “Owner” role. Map owner/manager to the existing hierarchy:

```text
SUPER_ADMIN  >  ADMIN  >  FRONT_DESK
```

| Role          | Reports? | Why                                                                                                                                 |
| ------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `SUPER_ADMIN` | **Yes**  | Full system; includes business oversight                                                                                            |
| `ADMIN`       | **Yes**  | Property / ops manager — month-end cash, occupancy, channel mix, export                                                             |
| `FRONT_DESK`  | **No**   | Daily ops only (check-in, Collect, calendar). They already see per-stay Due on the desk; they do not need property-wide cash/export |

**API:** `@StaffRoles('ADMIN')` on `/staff/reports/*` (ADMIN + SUPER_ADMIN).  
**PMS:** hide `/reports` nav (and block route) unless session role is `ADMIN` or `SUPER_ADMIN`. Deep link → same 403 / redirect pattern as other admin-only surfaces.

**Not** `SUPER_ADMIN`-only — that is staff-user CRUD. A normal business owner/GM account is expected to be `ADMIN`; locking reports to `SUPER_ADMIN` only would wrongly hide them from that person.

---

## 8. API shape

Staff-only aggregate reads — logic in `domain/reports/`, HTTP under `staff/reports/`.

| Method | Path | Returns |
| ------ | ---- | ------- |
| `GET` | `/staff/reports/summary?propertyId&from&to&compare=1` | `StaffReportsSummary`: cash · occupancy · occupancyByUnitType (+ nested units) · sourceMix · compare bundle |

**Implemented.** Cash filters `PaymentMovement.createdAt` via property-TZ → UTC half-open Instant bounds (index on `createdAt`). Occupancy / source nights use clip-length SQL (`LEAST/GREATEST` on stay/block dates), not per-night loops. One summary payload for the page; CSV is client-built from summary.

Wire types in `@cabin/api-contract`. Do not fork money helpers for cash aggregates — sum movement amounts.

---

## 9. Empty / edge states

| Case                   | UI                                                                   |
| ---------------------- | -------------------------------------------------------------------- |
| No property selected   | Prompt to pick property (same as Calendar)                           |
| No movements in period | Cash zeros + short “No cash posted in this period”                   |
| No stays / nights      | Occupancy 0% with available nights still shown; source mix all zeros |
| Available nights = 0   | Occupancy em dash / “n/a”, not divide-by-zero                        |

---

## 10. Relationship to other surfaces

| Surface                | Owns                                                             |
| ---------------------- | ---------------------------------------------------------------- |
| `/reservations` boards | Today’s tasks, Due column, Collect, Balance due chase            |
| `/calendar`            | Spatial busy/free                                                |
| `/` Dashboard          | Today strip (arrivals / in-house / due) — optional; not this doc |
| `/reports`             | Period cash · occupancy · source · compare · CSV                 |

---

## 11. Acceptance checklist

- [ ] One property + date range drives all sections
- [ ] `@StaffRoles('ADMIN')` + PMS hides Reports for `FRONT_DESK`
- [ ] Cash hero = movements in period (in / out / net + source → unit type → method)
- [ ] Occupancy % uses locked night rules; blocks reduce available
- [ ] Occupancy by unit type under property occupancy (expand → units)
- [ ] Source mix includes all `ReservationSource` values (incl. `WEBSITE`)
- [ ] No open-balances section — chase stays on Reservations
- [ ] Compare = previous equal-length period on cash / occupancy / type / source
- [ ] Spreadsheet/CSV export matches filters (PDF not required; browser Print optional)
- [ ] Footer honesty: cash ≠ OTA payout
- [ ] No ADR/RevPAR; no arrivals board clone; no Collect on Reports

---

## 12. References

| Doc                                                                          | Role                                     |
| ---------------------------------------------------------------------------- | ---------------------------------------- |
| [`reservations-design.md`](reservations-design.md)                           | Statuses, money, source, Due/Refund      |
| [`calendar-design.md`](calendar-design.md)                                   | Occupying nights, blocks, property scope |
| [`inventory-and-reservation-tables.md`](inventory-and-reservation-tables.md) | Tables                                   |
| [`.docs/cabin-pms-client-plan.md`](../.docs/cabin-pms-client-plan.md)        | Product brief                            |
