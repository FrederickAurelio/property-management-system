---
name: cabin-pms-phase
description: Guides Phase 1–3 build order for the cabin PMS (ops first, website booking second, CM last). Use when planning features, choosing what to build next, or deciding iCal vs Channel Manager scope.
---

# Cabin PMS phase guide

## When to use

Planning work, scoping a feature, or deciding whether something belongs in Phase 1, 2, or 3.

## Phase checklist

**Phase 1 (B2a) — build now**
- Auth, units, calendar, manual reservations
- Check-in / check-out, daily ops
- Basic reports
- Email ingest → WhatsApp/Telegram ping → quick confirm
- iCal import into PMS + Sync now (nice soon)

**Phase 2 (B2b)**
- `apps/web` booking engine writing to same API
- PMS export `.ics` per unit; OTAs import PMS hub

**Phase 3 (B1)**
- Paid CM only if iCal delay / scale hurts

## Decision shortcuts

| Request | Answer |
|---------|--------|
| Public browse/book UI now? | Phase 2 — after ops MVP |
| Real-time OTA rates/avail? | Needs CM — Phase 3 |
| Force OTA refresh from PMS? | No official API — do not ship bots |
| Sync prices via iCal? | No — prices manual until CM |

## Output

When planning, state the phase, which app folder(s), and the next smallest vertical slice.
