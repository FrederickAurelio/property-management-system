# iCal fixture server — client demo & QA

Mock OTA export calendars for **local** Cabin PMS testing. No real Airbnb/Booking account required.

Simulates import pull (`POST /staff/ical/sync-all`) and every `icalSyncWarning` edge case from `_docs/reservations-design.md` §9–10.

**Full coverage matrix:** [`COVERAGE.md`](./COVERAGE.md) — every design edge #1–24, all four warnings, export, and what cannot be mocked.

## Quick start

**Terminal 1 — stack (if not already running)**

```bash
pnpm db:up
pnpm --filter @cabin/api dev
pnpm --filter @cabin/pms dev
```

**Terminal 2 — fixture server**

```bash
pnpm ical:fixture:set 01-happy-path   # once, picks active .ics files
pnpm ical:fixtures                    # http://localhost:8765/
```

**PMS setup (one time per demo property)**

1. Login → **Skybreeze Sentraland** (seed inventory: `SEED_DEMO_INVENTORY=true pnpm prisma:seed`).
2. **Properties → Units → B-0801 → Edit → Calendars**
   - Airbnb import URL: `http://localhost:8765/airbnb/unit-a.ics`
   - Booking.com import URL: `http://localhost:8765/booking-com/unit-a.ics` *(OTA mesh demo)*
   - Agoda import URL: `http://localhost:8765/agoda/unit-a.ics` *(OTA mesh demo)*
3. For sibling demo only — **B-0802**:
   - Airbnb import URL: `http://localhost:8765/airbnb/unit-b.ics`
4. Save each unit.

**Every scenario**

1. `pnpm ical:fixture:set <scenario-id>` (or prep id — see below)
2. PMS **Dashboard → Sync all**
3. Check **Reservations** boards + reservation **detail** banners

Open **http://localhost:8765/** for a cheat sheet in the browser.

---

## Where staff sees results

| Surface | What to show the client |
|---------|-------------------------|
| **Dashboard** `/` | Sync all button; failing-feed amber line (`icalFeedHealth`) |
| **Reservations → Needs details** | New `UNCONFIRMED` iCal stubs |
| **Reservations → OTA issues** | `MISSING_FROM_FEED`, `DATES_DIFFER`, `OTA_STILL_LISTED`, `IMPORT_OVERLAP`, `UNIT_DIFFER` |
| **Reservation detail** | Playbook banner: Pick one · **Use {channel} dates** / **Nights are free now** / **Cancel this stay** / Dismiss |
| **Calendar** | Occupying stays; overlap **holds** do not block the grid |
| **Unit → Calendars** | Per-feed `lastError` / last success |

---

## Fixture UIDs (stable across scenarios)

| UID | Guest label | Used in |
|-----|-------------|---------|
| `cabin-demo-001` | Maria Santos | Happy path, dates differ |
| `cabin-demo-002` | James Chen | Overlap (Airbnb) |
| `cabin-demo-booking-mesh` | Priya Sharma | Booking.com mesh overlap |
| `cabin-demo-airbnb-mesh` | Second Airbnb guest | Two UIDs, same OTA feed |
| `cabin-demo-003` | Ayu Wijaya | Missing from feed |
| `cabin-demo-004` | Lee Min-ho | OTA still listed |
| `cabin-demo-moved` | Moved listing | Sibling unit feed |
| `cabin-demo-timed` | Timed Jakarta | DATE-TIME timezone |

---

## Client showcase script (recommended order)

Use unit **B-0801** unless noted. After each step, **Sync all**.

### 1 — New OTA booking (happy path)

```bash
pnpm ical:fixture:set 01-happy-path
```

| Check | Expected |
|-------|----------|
| Needs details | `UNCONFIRMED` · Airbnb · `Maria Santos (iCal)` · Aug 15–18 |
| OTA issues | (empty) |
| Detail | No warning banner |

**Talking point:** OTA sends a stub; staff enriches guest + money, then **Confirm**.

---

### 2 — Non-bookings filtered

```bash
pnpm ical:fixture:set 02-skipped-events
```

| Check | Expected |
|-------|----------|
| Import | Still only `cabin-demo-001` — cancelled + “CLOSED” rows ignored |

**Talking point:** Host blocks / closed nights in the OTA feed are not turned into guest reservations.

---

### 3 — Overlap hold (`IMPORT_OVERLAP`) — walk-in + OTA

**Prep in PMS (manual):** Create **walk-in** `CONFIRMED` on B-0801 for **Aug 20–23** (any guest).

```bash
pnpm ical:fixture:set 03-overlap-candidate
```

| Check | Expected |
|-------|----------|
| OTA issues | `James Chen (iCal)` · **Double-booked nights** · source **Airbnb** |
| Calendar | Walk-in blocks nights; OTA stub **does not** (waiting) |
| Detail | Pick one · **Nights are free now** / **Cancel this booking** |

**Talking point:** Walk-in vs OTA conflict — same handling as OTA vs OTA below.

**Resolve demo:** Cancel walk-in OR move it → **Nights are free now** → Confirm OTA stub.

---

### 3b — OTA mesh: already booked on Airbnb, Booking.com books same nights

Design edge **#3** — the case you asked about. Wire **both** import URLs on B-0801 (see setup above).

```bash
pnpm ical:fixture:set 03-prep-airbnb-only-demo-002
```

Sync → **Confirm** `James Chen` (Airbnb · Aug 20–23).

```bash
pnpm ical:fixture:set 09-ota-mesh-booking-com
```

Sync again.

| Check | Expected |
|-------|----------|
| Existing | `cabin-demo-002` stays **CONFIRMED** (Airbnb) |
| New stub | `Priya Sharma (iCal)` · **Booking.com** · **IMPORT_OVERLAP** |
| Calendar | First booking blocks; second is hold only |
| OTA issues | Both may show — focus on the overlap stub |

**Talking point:** Airbnb and Booking didn’t sync fast enough — PMS catches double-sell instead of hiding it.

**Optional — same OTA, two UIDs** (rare but possible on one feed):

```bash
# After Confirm cabin-demo-002 (same prep as above)
pnpm ical:fixture:set 09-airbnb-mesh-second-uid
```

Sync → **IMPORT_OVERLAP** on `cabin-demo-airbnb-mesh` (second Airbnb UID, same nights).

---

### 4 — Date change after confirm (`DATES_DIFFER`)

**Prep:** From step 1, **Confirm** `cabin-demo-001` (Aug 15–18).

```bash
pnpm ical:fixture:set 04-dates-changed
```

| Check | Expected |
|-------|----------|
| Status | Stays `CONFIRMED` (dates not auto-changed) |
| OTA issues | **Dates don’t match** |
| Detail | Pick one · **Use Airbnb dates** / Dismiss for now |

**Talking point:** Money and ops stay under staff control; Accept re-fetches OTA dates and checks overlap.

---

### 5 — UID gone (`MISSING_FROM_FEED`)

```bash
pnpm ical:fixture:set 05-prep-with-demo-003
```

Sync → **Confirm** `Ayu Wijaya` (Aug 22–25).

```bash
pnpm ical:fixture:set 05-missing-trigger
```

| Check | Expected |
|-------|----------|
| OTA issues | **Gone from Airbnb** on `cabin-demo-003` |
| Detail | Staff verifies OTA → **Cancel** if truly gone |

**Talking point:** No auto-cancel on confirmed stays — human verifies refund/cancel on OTA.

**Clear:** `pnpm ical:fixture:set 05-prep-with-demo-003` → sync → warning clears.

---

### 6 — OTA still lists after cancel (`OTA_STILL_LISTED`)

```bash
pnpm ical:fixture:set 06-still-listed
```

Sync → **Confirm** `Lee Min-ho` → **Cancel** in PMS.

Sync again (same scenario).

| Check | Expected |
|-------|----------|
| Status | Stays `CANCELLED` (not revived) |
| OTA issues | **Still on Airbnb** |
| Detail | **Dismiss** (sticky — won’t re-fire while UID in feed) |

**Clear when UID leaves feed:**

```bash
pnpm ical:fixture:set 05-missing-trigger
```

Sync → warning + dismiss ack cleared.

---

### 7 — Unit move / sibling feed (`UNIT_DIFFER`)

Wire **B-0802** with `http://localhost:8765/airbnb/unit-b.ics`.

```bash
pnpm ical:fixture:set 07-prep-moved-on-unit-a
```

Sync on unit A → **Confirm** `cabin-demo-moved` on **B-0801**.

```bash
pnpm ical:fixture:set 07-sibling-feed
```

Sync.

| Check | Expected |
|-------|----------|
| B-0801 reservation | **UNIT_DIFFER** (UID found on B-0802 — not a cancel) |
| Detail | Banner names observed unit · **Move to Airbnb’s unit** / Dismiss for now |

**Talking point:** Missing is property-wide per OTA source; a listing move becomes a desk warning so staff can move the stay after overlap check.

**Resolve:** **Move to Airbnb’s unit** (moves to B-0802 if nights free) or Edit unit manually.

---

### 8 — Timezone (DATE-TIME)

```bash
pnpm ical:fixture:set 08-timed-jakarta
```

| Check | Expected |
|-------|----------|
| New stub | `cabin-demo-timed` · check-in **2026-08-28** · check-out **2026-08-31** (Asia/Jakarta) |

---

### 9 — Empty feed (glitch protection)

```bash
pnpm ical:fixture:set empty
```

| Check | Expected |
|-------|----------|
| Unit Calendars | `lastError` ≈ “0 events…” |
| Dashboard | Failing feed count |
| Reservations | **Unchanged** — no MISSING storm |

---

### 10 — Export (PMS → OTA)

On a unit with a **confirmed** occupying stay:

1. Unit form → **Copy** export `.ics` URL.
2. Open `http://localhost:5173/public/ical/units/...?token=...` in browser.

| Check | Expected |
|-------|----------|
| File | Valid `.ics` busy ranges, no guest PII |
| Overlap holds | **Not** in export until confirmed |

**Talking point:** OTAs poll this URL; lag is normal (minutes).

---

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm ical:fixtures` | Start server on `:8765` (override: `ICAL_FIXTURE_PORT`) |
| `pnpm ical:fixture:set <id>` | Swap active feeds |
| `pnpm ical:fixture:set --list` | List scenario ids |

**Prep ids** (not in main manifest table):

- `05-prep-with-demo-003`
- `07-prep-moved-on-unit-a`

---

## Automated tests

Logic unit tests (no HTTP server):

```bash
pnpm --filter @cabin/api test -- ical-import.service.spec.ts
```

---

## Files

```text
scripts/ical-fixtures/
  serve.mjs              # HTTP server + browser index
  set-scenario.mjs       # Copy scenario → active/
  active/                # Served files (git-tracked default)
  scenarios/             # Source .ics + manifest.json
  README.md              # This guide
```

---

## Production note

These URLs are **localhost only** for demos. Production uses real OTA export links from each extranet; behavior is the same after **Sync all** or the ~10-minute cron.
