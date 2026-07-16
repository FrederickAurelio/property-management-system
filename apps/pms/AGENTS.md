# apps/pms

Staff Property Management UI (`@cabin/pms`). **Phase 1 frontend.** Talks only to `apps/api`.

## Status

- Vite + React + TS ready
- Tailwind CSS v4 (`@tailwindcss/vite`) + Prettier class sort
- shadcn/ui (radix-nova); import via `@/` → `src/`
- API client: `src/lib/api` (session cookies + envelope unwrap)
- **Not yet:** routing, auth UI, domain screens

## Stack (locked)

- React + Vite + TypeScript
- Tailwind CSS v4 + shadcn/ui

## API client

- Always use [`src/lib/api/client.ts`](src/lib/api/client.ts) — never raw `fetch` to the API.
- Shared HTTP contract types: `@cabin/api-contract` (envelope, codes, `PublicAdmin`, `AdminRole`) — do not duplicate cross-app types here.
- `credentials: 'include'` (cookie `cabin.pms.sid`).
- Success body `{ data, meta? }` → client returns `data`.
- Errors `{ error: { code, message, details? } }` → throws `ApiError`.
- Staff auth helpers: `staffLogin` / `staffLogout` / `staffMe` in `src/lib/api/staff-auth.ts`.
- 401 hook: `setUnauthorizedHandler(() => …)` (wire to `/login` when routing exists).
- Env: root `.env` → `VITE_API_URL` (`vite.config` `envDir` = repo root).

## Run

```bash
pnpm --filter @cabin/pms dev
pnpm --filter @cabin/pms typecheck
pnpm --filter @cabin/pms format
```

Add UI: from repo root → `pnpm dlx shadcn@latest add <component> -c apps/pms`

## Phase 1 screens

1. Staff login
2. Units CRUD
3. Calendar (busy/free per unit)
4. Manual reservations
5. Check-in / check-out + daily arrivals/departures
6. Basic reports
7. Quick-confirm (pre-filled draft → Confirm)
8. Optional: Sync now + “refresh OTA if urgent” checklist

## UX

- Optimize for front-desk speed, not marketing
- Quick-confirm = review draft, minimal typing
- Honor roles from API (`SUPER_ADMIN` | `ADMIN` | `FRONT_DESK`)
- Be honest about iCal delay; never promise zero conflicts

### UI skills (PMS only)

Use only these from [`.cursor/skills/`](../../.cursor/skills/README.md):

| Order | Skill | For |
|-------|--------|-----|
| 1 | `shadcn` | Add/compose shadcn components |
| 2 | `product-ui-design` | Shipped admin look; anti AI-slop |

Do **not** load `ui-design-brain` / `ui-craft` / `ui-craft-dense-dashboard` for PMS — those are reserved for customer-facing `apps/web` (Phase 2).

Anchor DNA: **Linear-dense / Stripe-data**. No purple gradients, glowing status dots, or landing-page hero patterns.

## Don’t

- Public guest browse/book flows (that’s `apps/web`)
- Call OTAs from the browser
- Invent local booking truth that bypasses the API
- Put tokens in `localStorage` (session cookie only)
- Use `npm i` inside this folder (pnpm from repo root only)

Root: `AGENTS.md` · Plan: `.docs/cabin-pms-client-plan.md`
