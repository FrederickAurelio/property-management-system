# apps/pms — Agent Brief

Staff-facing Property Management System UI. This is the **Phase 1 frontend**.

## Role

- Ops brain for front desk / admin: units, calendar, reservations, check-in/out, reports, quick-confirm
- Talks only to `apps/api` — no direct OTA APIs
- Not the public guest site (`apps/web` is Phase 2)

## Phase 1 screens (priority)

1. Auth (staff login)
2. Units list / CRUD
3. Calendar (busy/free per unit)
4. Manual reservation create/edit
5. Check-in / check-out + daily arrivals/departures
6. Basic reports
7. Quick-confirm draft reservation (pre-filled from email ingest ping)
8. Optional: Sync now + “refresh Airbnb/Agoda if urgent” checklist

## UX notes

- Optimize for speed of confirm and daily ops, not marketing polish
- Quick-confirm should feel like reviewing a draft PR: pre-filled → Confirm → saved
- Warn about iCal delay / double-book risk when relevant; do not promise zero conflicts
- Roles: admin vs front desk — hide admin-only settings accordingly

See also: root `AGENTS.md`, `.docs/cabin-pms-client-plan.md`
