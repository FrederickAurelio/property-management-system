# apps/web

Public browse/booking UI. **Phase 2** — idle scaffold until Phase 2 is explicitly started.

## Stack

**Undecided.** Choose when Phase 2 starts. Do not assume the same stack as `pms`.

Whatever the FE is, bookings write to the shared `apps/api` (`source: website`).

## Phase 2 scope

1. Browse units + availability (from API)
2. Book → reservation in shared API
3. Relies on API iCal export hub for OTAs

## UI skills (Phase 2 — customer-facing)

When Phase 2 UI work starts, prefer skills reserved under [`.cursor/skills/`](../../.cursor/skills/README.md):

| Skill | For |
|-------|-----|
| `ui-design-brain` | Component patterns + a11y |
| `ui-craft` | Broader craft / anti-slop |
| `ui-craft-dense-dashboard` | Dense data screens if needed |
| `shadcn` | Only if the chosen stack uses shadcn |

`product-ui-design` is the PMS/admin register — use it on `web` only for app-chrome surfaces (account/settings), not marketing/browse heroes.

## Don’t

- Build this before Phase 1 ops MVP is solid
- Separate booking database
- Staff check-in, reports, or quick-confirm here
- Lock a FE stack here without an explicit decision

Until Phase 2: prefer work in `api` + `pms`.

Root: `AGENTS.md` · Plan: `.docs/cabin-pms-client-plan.md`
