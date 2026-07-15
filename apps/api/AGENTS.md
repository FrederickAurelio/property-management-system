# apps/api — Agent Brief

Backend for the Cabin PMS. **Single source of truth** for units, reservations, staff auth, check-in/out, reports, email ingest, and (later) iCal + public booking writes.

## Role

- Serves `apps/pms` (Phase 1) and `apps/web` (Phase 2)
- Owns the database and business rules
- Does **not** scrape OTAs or trigger remote OTA refresh

## Phase 1 API surface (priority)

1. Auth + staff roles (admin / front desk)
2. Units CRUD
3. Reservations CRUD (sources: `manual`, later `website`, `booking_com`, `airbnb`, `agoda`)
4. Calendar / availability queries
5. Check-in / check-out status workflow
6. Basic reports (occupancy, arrivals/departures, revenue by source)
7. Email ingest → draft reservation → notify → confirm endpoint
8. iCal import + Sync now (Phase 1.x)

## Domain model

```text
property → unit_type (optional) → unit → reservations / blocks
```

One calendar per **unit**. Avoid allotment-first design unless product explicitly needs it.

## Rules of engagement

- Overlap / double-book detection belongs here, not only in the UI
- “Sync all” refreshes **our** copy of calendars — it does not force OTAs to pull
- Keep secrets in env; never commit credentials
- Prefer clear domain modules (units, reservations, auth, ingest, ical) over a dump of routes

## Local agent files

- Rules: `.cursor/rules/`
- Skills: `.cursor/skills/`

See also: root `AGENTS.md`, `.docs/cabin-pms-client-plan.md`
