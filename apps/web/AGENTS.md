# apps/web

Public browse/booking UI. **Phase 2 only** — customer FE. Idle scaffold until Phase 2 is explicitly started.

Phase 2 is **not** “when reservations or payments begin.” Phase 1 staff PMS already runs live manual + OTA bookings (incl. money/DP) on the same API. This app only adds the **guest-facing** book path (`source: website`) into that model.

## Stack

**Undecided.** Choose when Phase 2 starts. Do not assume the same stack as `pms`.

Whatever the FE is, bookings write to shared `apps/api` via `/public/...` → `domain/reservations` (same columns: status, source, total/paid/`paymentStatus`).

## Phase 2 scope

1. Browse units + availability (from API)
2. Book → reservation in shared API (`source=WEBSITE`)
3. Relies on API iCal **export** hub for OTAs

Design context: [`_docs/reservations-design.md`](../../_docs/reservations-design.md) · root `AGENTS.md` phase framing.

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
- Separate booking or payment database
- Reinvent reservation/money schema — reuse Phase 1 domain
- Staff check-in, reports, or iCal enrich queues here
- Lock a FE stack here without an explicit decision

Until Phase 2: prefer work in `api` + `pms`.

Root: `AGENTS.md` · Plan: `.docs/cabin-pms-client-plan.md`
