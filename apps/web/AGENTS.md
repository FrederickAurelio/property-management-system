# apps/web

Public browse/booking UI (`@cabin/web`). **Phase 2** customer FE. Scaffold is in place; marketing/book surfaces build when Phase 2 UI is explicitly started.

Phase 2 is **not** “when reservations or payments begin.” Phase 1 staff PMS already runs live manual + OTA bookings (incl. money/DP) on the same API. This app only adds the **guest-facing** book path (`source: WEBSITE`) into that model.

## Status

- Vite + React + TS scaffold
- Tailwind CSS v4 (`@tailwindcss/vite`) + shared tokens via `@cabin/ui-tokens`
- shadcn/ui (radix-nova); import via `@/` → `src/`
- i18n: `i18next` + `react-i18next` — locales **en** / **id** / **zh** (`src/locales/`, `src/i18n`)
- Theme: `next-themes` + light/dark toggle scaffold
- Home page scaffold; browse/book API wiring not started

## Run

```bash
pnpm --filter @cabin/web dev   # http://localhost:5174 (PMS is :5173)
pnpm --filter @cabin/web typecheck
pnpm --filter @cabin/web lint
```

Add UI: from repo root → `pnpm dlx shadcn@latest add <component> -c apps/web`

## Stack (locked)

| Concern | Choice |
|---------|--------|
| UI | React + Vite + TypeScript · Tailwind CSS v4 · shadcn/ui (radix-nova) · Lucide |
| Tokens | `@cabin/ui-tokens` (`tokens.css` + `theme.css`) — shared with `pms`; not React components |
| i18n | `i18next` · `react-i18next` · browser language detector · **en** / **id** / **zh** |
| Public HTML / SEO | Prerender / SSG for marketing + listing pages (real HTML at build). Book / manage-stay wizards may stay CSR |
| API | Nest `apps/api` only — browser `/api/...` → Nest `/public/...` |
| CDN (prod) | Cloudflare (or equivalent) in front of the public origin; cache static assets; **never** cache `/api/` |
| Theme | `next-themes` · class strategy (`.dark`) |
| Not default | Next.js / per-request SSR — only if SEO-led growth + Node FE ops are explicitly chosen later |

Bookings write shared `domain/reservations` (same status, source, total/paid/`paymentStatus`). Do not route Nest `/staff` through the web origin.

shadcn/React components stay **app-local** (`src/components/ui`). Shared look = tokens only until the same primitive is copy-pasted and must stay identical — then consider `packages/ui`. See [`packages/ui-tokens/AGENTS.md`](../../packages/ui-tokens/AGENTS.md).

## Phase 2 scope

1. Browse units + availability (from API)
2. Book → reservation in shared API (`source=WEBSITE`)
3. Relies on API iCal **export** hub for OTAs
4. Guest cancel / change-date / refund **self-serve** only after client policy is locked (else staff PMS)

Design context: [`_docs/reservations-design.md`](../../_docs/reservations-design.md) · Impeccable product record: [`PRODUCT.md`](PRODUCT.md) · root `AGENTS.md` phase framing.

## Before visual build

1. Client discovery (brand, photos, policies, traffic/SEO — see `PRODUCT.md` open fields).
2. Refresh product truth: `/impeccable init` (update `PRODUCT.md`).
3. Visual world: Impeccable new-work / `document` → `DESIGN.md` (do not invent brand). Token values live in `@cabin/ui-tokens` until brand lands.

## UI skills (customer-facing)

See [`.cursor/skills/README.md`](../../.cursor/skills/README.md) and [`.cursor/rules/web-ui.mdc`](../../.cursor/rules/web-ui.mdc).

| Surface | Skills |
|---------|--------|
| Marketing / landing / unit story (**Persuade**) | **`impeccable`** (primary) |
| Browse → book → manage stay (**Operate**) | `impeccable` + `ui-craft` / `ui-design-brain` as needed |
| Guest account chrome | `product-ui-design` (restraint) |
| Component install | **`shadcn`** (radix-nova; same preset family as PMS) |

Do **not** load PMS-only admin patterns onto marketing heroes.

## Don’t

- Separate booking or payment database
- Reinvent reservation/money schema — reuse Phase 1 domain
- Staff check-in, reports, or iCal enrich queues here
- Next.js by default “for SEO” — prefer Vite prerender first
- Duplicate `:root` / `@theme` colors in this app — edit `@cabin/ui-tokens`
- Invent brand, testimonials, or cancel policies before client answers
- Skip CDN planning for the public origin when shipping prod
- `useEffect` to sync derived UI or reset forms from props — prefer render-time calc / `key` remount ([You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect))

Root: `AGENTS.md` · Plan: `_docs/cabin-pms-client-plan.md`
