# apps/web — Agent Brief

Public browse / booking frontend for the company website. **Phase 2** — do not treat as current MVP unless the user explicitly starts Phase 2.

## Role

- Guests browse units and book
- Writes reservations into the **same** `apps/api` as the PMS
- Not a staff tool (staff use `apps/pms`)

## Phase 2 scope (when activated)

1. Unit browse + availability
2. Booking flow → creates reservation in API (`source: website`)
3. Works with PMS iCal **export hub** (API exports `.ics` per unit for OTAs)

## Rules of engagement

- Until Phase 2 is started: keep this app minimal (scaffold only); prefer work in `api` + `pms`
- Never invent a separate booking database
- Availability must respect PMS calendar truth (including OTA-derived blocks once imported)
- Guest UX can be branded/marketing-led; still one composition, no ops-dashboard clutter

## Local agent files

- Rules: `.cursor/rules/`
- Skills: `.cursor/skills/`

See also: root `AGENTS.md`, `.docs/cabin-pms-client-plan.md`
