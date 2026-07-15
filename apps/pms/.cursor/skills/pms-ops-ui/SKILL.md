---
name: pms-ops-ui
description: Guides staff PMS UI flows for calendar, check-in, and quick-confirm. Use when building screens or UX in apps/pms.
---

# PMS ops UI skill

## Primary flows

1. **Calendar** — busy/free by unit; create/edit reservation from a date range
2. **Daily ops** — today’s arrivals, departures, in-house
3. **Check-in / check-out** — status transitions with clear next action
4. **Quick confirm** — open draft from ping → review fields → Confirm
5. **Reports** — occupancy, arrivals/departures, revenue by source

## Quick-confirm UX

```text
Ping link → pre-filled draft → staff edits if needed → Confirm → reservation saved
```

Optional checklist after confirm: “Refresh Airbnb / Agoda if urgent.”

## UI priorities

- Speed for front desk over visual novelty
- Empty states that point to “add unit” / “create reservation”
- Errors from API overlap checks shown clearly
