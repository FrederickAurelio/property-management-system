# apps/pms

Staff Property Management UI (`@cabin/pms`). **Phase 1 frontend.** Talks only to `apps/api`.

## Status

- Vite + React + TS ready
- Tailwind CSS v4 (`@tailwindcss/vite`) + Prettier class sort
- shadcn/ui (radix-nova); import via `@/` → `src/`
- Declarative React Router (`BrowserRouter`) + TanStack Query providers
- Routes: `/login` (public staff login) · `/` private app shell (`PrivateRoute` → `AppLayout` → children)
- Axios API client: `src/lib/api` (session cookies + envelope unwrap + Sonner helpers)
- RHF + Zod + shadcn `Field` / `Controller` (login + inventory forms wired)
- Inventory explorer wired to Nest (`/staff/properties|unit-types|units`) — infinite lists + CRUD
- **Not yet:** reservations / calendar / check-in ops screens

## Stack (locked)

| Concern      | Choice                                                                            |
| ------------ | --------------------------------------------------------------------------------- |
| UI           | React + Vite + TypeScript · Tailwind CSS v4 · shadcn/ui (radix-nova) · Lucide     |
| Routing      | `react-router` declarative (`BrowserRouter` + `Routes`)                           |
| Server state | `@tanstack/react-query`                                                           |
| HTTP         | `axios` · `baseURL: "/api"` · Vite/prod reverse-proxy to Nest                     |
| Forms        | `react-hook-form` + `zod` + `@hookform/resolvers` · shadcn `Field` + `Controller` |
| Toasts       | Sonner (`handleSuccess` / `handleError`)                                          |
| Theme        | `next-themes` (`ThemeProvider` + `ThemeToggle`) · class strategy (`.dark`)        |

## API client

- Always import `api` from [`src/lib/api`](src/lib/api) — never create another axios instance / raw `fetch` to the Nest API.
- Call sites: `api.get` / `api.post` / `api.patch` / `api.delete`. Interceptors handle envelope + errors.
- Shared HTTP contract types: `@cabin/api-contract` (envelope, codes, `StaffAdmin`, `AdminRole`) — do not duplicate cross-app types here.
- `withCredentials: true` (cookie `cabin.pms.sid`).
- `baseURL: "/api"`. Dev: Vite proxies `/api` → Nest (`VITE_API_URL`, default `http://localhost:3000`) and strips the prefix. Prod: reverse-proxy `/api` the same way.
- Success `{ data, meta? }` → interceptor sets `response.data` to unwrapped `data` → `(await api.get<T>(…)).data`.
- Errors `{ error: { code, message, details? } }` → throws `ApiError`. Also maps timeout / network / 502–504 to FE-only codes (`TIMEOUT`, `NETWORK_ERROR`, `SERVER_UNAVAILABLE`).
- Staff auth helpers: `staffLogin` / `staffLogout` / `staffSession` (thin `api.*` wrappers) — paths `/staff/auth/*`.
- Staff admin helpers: `listAdmins` / `createAdmin` / `changeAdminRole` / `setAdminActive` (`/staff/admins`, SUPER_ADMIN). Query key: `staffAdminsQueryKey`.
- Inventory helpers: `listProperties` / `listUnitTypes` / `listUnits` (+ create/update/delete + detail GETs) under `/staff/properties|unit-types|units`. Wire types `StaffProperty` / `StaffUnitType` / `StaffUnit`; lists are `Paginated<T>`.
- SPA routes like `/properties` are UI-only — never invent unprefixed Nest paths.
- 401 hook: `setUnauthorizedHandler` (wired to `/login` via `UnauthorizedRedirect`). Session probe on login uses `{ skipUnauthorizedRedirect: true }`.
- Toasts: `handleSuccess` / `handleError` from screens/mutations — **not** inside the interceptor.
- Env: root `.env` → `VITE_API_URL` is the **proxy target only** (`vite.config` `envDir` = repo root).
- GET lists: Skeleton + `QueryRetryButton` on page-1 error; infinite lists use `InfiniteListFooter` (see `.cursor/rules/pms-ui.mdc`).

## Server state (TanStack Query)

Locked BE→FE wiring (keys, `useQuery` / `useInfiniteQuery` / `useMutation`, cache, toast vs field highlight): [`.cursor/rules/pms-query.mdc`](../../.cursor/rules/pms-query.mdc).

| Concern | Rule |
|---------|------|
| Query keys | `src/lib/api/query-keys.ts` — import from `@/lib/api` |
| Paginated lists | `useInfiniteQuery` + `getNextPageParamFromPageInfo`; filters in key |
| List writes | `invalidateQueries` on resource prefix + `handleSuccess` |
| Login / self-profile | `setQueryData(staffSessionQueryKey, …)` |
| Form domain errors | `applyApiFieldError` → RHF (BE `details: { field, reason }`) |
| Everything else | `handleError` toast (or re-auth dialog / GET retry) |

## Forms

Use shadcn’s RHF pattern: `useForm` + `zodResolver` + `Controller` + `<Field />` (not the legacy `<Form>` wrapper). See [shadcn React Hook Form](https://ui.shadcn.com/docs/forms/react-hook-form). Zod bounds from `@cabin/api-contract`. Field names must match Nest DTO / `details.field`.

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

- **Responsive web + mobile** — staff use desk and handheld; plan both from the start (`.cursor/rules/pms-ui.mdc`)
- Optimize for front-desk speed, not marketing
- Quick-confirm = review draft, minimal typing
- Honor roles from API (`SUPER_ADMIN` | `ADMIN` | `FRONT_DESK`)
- Be honest about iCal delay; never promise zero conflicts

### UI skills (PMS only)

**Always use** — in order — from [`.cursor/skills/`](../../.cursor/skills/README.md). **Apply with judgment**; skills are defaults, not gospel. Full workflow + when to override: `.cursor/rules/pms-ui.mdc`.

| Order | Skill               | For                              |
| ----- | ------------------- | -------------------------------- |
| 1     | `shadcn`            | Add/compose shadcn components    |
| 2     | `product-ui-design` | Shipped admin look; anti AI-slop |

Do **not** load `ui-design-brain` / `ui-craft` / `ui-craft-dense-dashboard` for PMS — reserved for `apps/web` (Phase 2).

Anchor DNA: **Linear-dense / Stripe-data**. No purple gradients, glowing status dots, or landing-page hero patterns.

## Don’t

- Public guest browse/book flows (that’s `apps/web`)
- Call OTAs from the browser
- Invent local booking truth that bypasses the API
- Put tokens in `localStorage` (session cookie only)
- Use `npm i` inside this folder (pnpm from repo root only)

Root: `AGENTS.md` · Plan: `.docs/cabin-pms-client-plan.md`
