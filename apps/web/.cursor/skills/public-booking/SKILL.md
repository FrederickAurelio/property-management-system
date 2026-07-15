---
name: public-booking
description: Guides Phase 2 public browse and booking flows in apps/web against the shared PMS API. Use when building guest-facing booking UI or deciding Phase 2 scope.
---

# Public booking skill

## When Phase 2 is active

Build guest browse → availability → book against `apps/api`.

## Flow

```text
Browse units → pick dates → API availability → book → reservation (source: website)
```

PMS then exports updated `.ics` per unit for OTAs (hub model).

## Guardrails

- If user asks for public booking during Phase 1: scaffold only, or confirm they want to start Phase 2
- Same unit calendar as staff PMS — no shadow inventory
- Handle sold-out / overlap errors from API gracefully

## Out of scope here

Staff auth, check-in, reports, email quick-confirm (those live in `apps/pms`)
