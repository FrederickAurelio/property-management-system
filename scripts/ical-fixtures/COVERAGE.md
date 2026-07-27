# iCal fixture coverage matrix

Full map of **import/export/sync** behavior vs mock fixtures, manual PMS steps, and inherent iCal limits.

Legend: **✅** fixture scenario · **📋** prep + fixture · **🖥️** PMS-only (no new `.ics`) · **⏳** industry/iCal limit · **🧪** Jest only

---

## All four `icalSyncWarning` values

| Warning | Fixture | How to run |
|---------|---------|------------|
| `IMPORT_OVERLAP` | ✅ `03-overlap-candidate` | Manual walk-in Aug 20–23 → sync |
| | ✅ `09-ota-mesh-booking-com` | Prep `03-prep-airbnb-only-demo-002` → Confirm → sync |
| | ✅ `09-airbnb-mesh-second-uid` | Same prep → sync |
| | ✅ `14-agoda-mesh` | Same prep + Agoda URL on unit |
| | ✅ `13-block-overlap` | Calendar block Aug 25–28 → sync |
| `DATES_DIFFER` | ✅ `04-dates-changed` | Confirm `cabin-demo-001` → sync |
| | ✅ `04-dates-match-again` | After DATES_DIFFER → sync (clears warning) |
| `MISSING_FROM_FEED` | ✅ `05-missing-trigger` | Prep `05-prep-with-demo-003` → Confirm → sync |
| | 📋 `manual-missing-checked-in` | Same prep → Confirm → **Check-in** → sync |
| `UNIT_DIFFER` | ✅ `07-sibling-feed` | Prep `07-prep-moved-on-unit-a` → Confirm on B-0801 → set sibling → sync |

---

## Design doc §10 edge catalog (#1–24)

| # | Situation | Coverage |
|---|-----------|----------|
| 1 | Save overlaps occupying stay/block | 🖥️ Manual create/edit 409 — not iCal import |
| 2 | iCal stub + manual same dates | 🖥️ `manual-stub-vs-walkin-409` |
| 3 | Two OTAs same nights (mesh) | ✅ `09-ota-mesh-booking-com`, `14-agoda-mesh`, `09-airbnb-mesh-second-uid` |
| 4 | Walk-in before OTA polls export | 🖥️ `manual-export-busy` + explain lag |
| 5–9 | Money (paid, complimentary, overpay, extend, shrink) | 🖥️ Reservation detail — not iCal |
| 10 | Move to another unit | ✅ `07-sibling-feed` → `UNIT_DIFFER` + Accept OTA unit |
| 11 | Unit MAINTENANCE with future stays | 🖥️ Inventory — not iCal |
| 12 | Early check-in/out | 🖥️ Reservation ops — not iCal |
| 13–14 | Never arrived / cancel + refund | 🖥️ Cancel sheet — not iCal |
| 15 | OTA cancel (UID gone) after Confirm | ✅ `05-missing-trigger` |
| 16 | OTA date change after Confirm | ✅ `04-dates-changed` |
| 17 | UID after cancel/checkout | ✅ `06-still-listed` + 📋 checkout variant |
| 18 | Opaque SUMMARY | ✅ `11-opaque-summary` |
| 19 | Same-day turnaround | ✅ `12-turnaround` |
| 20–21 | Check-in with due / edit guest | 🖥️ Desk ops — not iCal |
| 22 | Multi-property | 🖥️ Property selector on boards |
| 23 | Empty / failed sync | ✅ `empty`, `only-skipped` + fixed URL `http://localhost:8765/errors/http-404.ics` |
| 24 | Export token leaked | 🖥️ `manual-rotate-token` |

---

## Import behavior (§9)

| Behavior | Coverage |
|----------|----------|
| New UID → `UNCONFIRMED` | ✅ `01-happy-path` |
| Match `(source, externalRef)` update | ✅ all scenarios with same UID |
| Never clobber guest/money on `CONFIRMED+` | ✅ `04-dates-changed` |
| `IMPORT_OVERLAP` + `icalOverlapHold` | ✅ overlap scenarios |
| Hold excluded from calendar/export | 🖥️ `manual-export-hold-excluded` |
| Skip `STATUS:CANCELLED` | ✅ `02-skipped-events` |
| Skip block-like SUMMARY | ✅ `02-skipped-events`, `only-skipped` |
| All-day `VALUE=DATE` | ✅ most fixtures |
| Timed `DATE-TIME` + timezone | ✅ `08-timed-jakarta` |
| Empty body → `lastError`, no MISSING | ✅ `empty`, `only-skipped` |
| Cancelled-only → success + MISSING | 🧪 `ical-import.service.spec.ts` (STATUS:CANCELLED-only) |
| HTTP error on pull | 🖥️ paste `errors/http-404.ics` URL temporarily |
| UNCONFIRMED date auto-apply | ✅ `10-unconfirmed-dates-shift` |
| Property-wide MISSING (sibling feeds) | ✅ `07-sibling-feed` (now `UNIT_DIFFER` when UID on sibling) |
| Sticky `OTA_STILL_LISTED` dismiss | ✅ `06-still-listed` (Dismiss → re-sync) |
| Batch events in one pull | ✅ `15-batch-import` |
| Unique race on insert | 🧪 `ical-import.service.spec.ts` |

---

## Export (PMS → OTA)

| Behavior | Coverage |
|----------|----------|
| Busy occupying stays + blocks | 🖥️ `manual-export-busy` |
| No PII in `.ics` | 🖥️ inspect export file |
| Holds not exported | 🖥️ `manual-export-hold-excluded` |
| Token auth / rotate | 🖥️ `manual-rotate-token` |
| Served via PMS origin proxy | 🖥️ `PUBLIC_PMS_BASE_URL` + `/public/ical/...` |

---

## Cannot mock (say explicitly in client demo)

| Topic | Why |
|-------|-----|
| Real OTA poll interval | Airbnb/Booking refresh on their schedule |
| Zero double-book guarantee | iCal is eventually consistent |
| Price/rate sync | Not in iCal spec |
| Remote OTA cancel/confirm | Staff uses extranet |
| Email ingest | Out of scope Phase 1 |

---

## Scenario index (all fixture ids)

Run: `pnpm ical:fixture:set <id>` then **Sync all**.

| ID | One-line |
|----|----------|
| `01-happy-path` | New stub |
| `02-skipped-events` | Filter cancelled/blocked |
| `only-skipped` | 0 bookable after filter |
| `03-overlap-candidate` | Walk-in vs OTA overlap |
| `09-ota-mesh-booking-com` | Airbnb + Booking.com mesh |
| `09-airbnb-mesh-second-uid` | Two Airbnb UIDs same nights |
| `14-agoda-mesh` | Airbnb + Agoda mesh |
| `13-block-overlap` | OTA vs calendar block |
| `10-unconfirmed-dates-shift` | UNCONFIRMED dates update |
| `04-dates-changed` | DATES_DIFFER |
| `04-dates-match-again` | Clear DATES_DIFFER |
| `05-missing-trigger` | MISSING_FROM_FEED |
| `06-still-listed` | OTA_STILL_LISTED after cancel |
| `07-sibling-feed` | UNIT_DIFFER (UID on sibling unit) |
| `08-timed-jakarta` | Timezone |
| `11-opaque-summary` | "Reserved" guest name |
| `12-turnaround` | Same-day in/out |
| `15-batch-import` | 3 stubs at once |
| `empty` | Empty calendar |

**Prep ids:** `03-prep-airbnb-only-demo-002` · `05-prep-with-demo-003` · `07-prep-moved-on-unit-a`

**Fixed error URLs (paste temporarily on unit):**

- `http://localhost:8765/errors/http-404.ics`
- `http://localhost:8765/errors/http-500.ics`

---

## Automated tests (CI)

```bash
pnpm --filter @cabin/api test -- ical-import.service.spec.ts
pnpm --filter @cabin/api test -- ical-export
```

Covers: OTA_STILL_LISTED, sticky dismiss, overlap hold, empty feed, MISSING + sibling, timezone, unique race, create failure.
