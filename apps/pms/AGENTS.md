# apps/pms

Staff Property Management UI (`@cabin/pms`). **Phase 1 frontend.** Talks only to `apps/api`.

## Status

- Vite + React + TS ready
- Tailwind CSS v4 (`@tailwindcss/vite`) + Prettier class sort
- shadcn/ui (radix-nova); import via `@/` → `src/`
- **Not yet:** routing, auth UI, domain screens

## Stack (locked)

- React + Vite + TypeScript
- Tailwind CSS v4 + shadcn/ui

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
- Honor roles from API (`admin` / `front_desk`)
- Be honest about iCal delay; never promise zero conflicts

## Don’t

- Public guest browse/book flows (that’s `apps/web`)
- Call OTAs from the browser
- Invent local booking truth that bypasses the API
- Use `npm i` inside this folder (pnpm from repo root only)

Root: `AGENTS.md` · Plan: `.docs/cabin-pms-client-plan.md`
