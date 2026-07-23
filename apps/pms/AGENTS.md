# apps/pms

Staff Property Management UI (`@cabin/pms`). **Phase 1 production frontend** for live desk ops (manual + OTA). Talks only to `apps/api`. Phase 2 customer book is `apps/web` — not a reason to skip money/DP or reservation completeness here.

## Status

- Vite + React + TS ready
- Tailwind CSS v4 (`@tailwindcss/vite`) + Prettier class sort
- shadcn/ui (radix-nova); import via `@/` → `src/`
- Declarative React Router (`BrowserRouter`) + TanStack Query providers
- Routes: `/login` (public staff login) · `/` private app shell (`PrivateRoute` → `AppLayout` → children)
- Axios API client: `src/lib/api` (session cookies + envelope unwrap + Sonner helpers)
- RHF + Zod + shadcn `Field` / `Controller` (login + inventory forms wired)
- Inventory explorer wired to Nest (`/staff/properties|unit-types|units`) — infinite lists + CRUD
- Reservations wired to Nest `/staff/reservations`: desk boards on `/reservations` (Arrivals/Departures include overdue + Late badge; **no** `/check-in` page) · Choose unit (all properties/types/units + inactive/blocked rows) · stay dates blocked by unit occupancy · Collect/Cancel as **cash movements** · Paid = sum(movements) · early check-in/out via `confirmEarly` · Total = `nights × defaultPriceIdr`
- **Bookability UX:** Property “Open for ops” · Type “Offered for booking” · Unit status only (`ACTIVE` = bookable)
- **Calendar** (`/calendar`): unit × days grid on Nest `GET /staff/properties/:id/calendar` + `/staff/calendar-blocks` CRUD; live property options + create reservation + detail
- **Reports** (`/reports`): period summary (cash · occupancy · source mix · compare · CSV) via `GET /staff/reports/summary`; ADMIN/SUPER_ADMIN only
- **Dashboard** (`/`): today arrivals/departures + needs attention via `GET /staff/dashboard`; Sync all → toast only; FRONT_DESK+
- **Not yet:** iCal sync enqueue · Accept-iCal actions
- **Design:** [`_docs/reservations-design.md`](../../_docs/reservations-design.md) · [`_docs/calendar-design.md`](../../_docs/calendar-design.md) · [`_docs/dashboard-design.md`](../../_docs/dashboard-design.md) · [`_docs/reports-design.md`](../../_docs/reports-design.md)

## Stack (locked)

| Concern      | Choice                                                                            |
| ------------ | --------------------------------------------------------------------------------- |
| UI           | React + Vite + TypeScript · Tailwind CSS v4 · shadcn/ui (radix-nova) · Lucide     |
| Routing      | `react-router` declarative (`BrowserRouter` + `Routes`)                           |
| Server state | `@tanstack/react-query`                                                           |
| HTTP         | `axios` · `baseURL: "/api"` · paths without `/staff` · proxy `/api` → Nest `/staff` |
| Forms        | `react-hook-form` + `zod` + `@hookform/resolvers` · shadcn `Field` + `Controller` |
| Toasts       | Sonner (`handleSuccess` / `handleError`)                                          |
| Theme        | `next-themes` (`ThemeProvider` + `ThemeToggle`) · class strategy (`.dark`)        |

## API client

- Always import `api` from [`src/lib/api`](src/lib/api) — never create another axios instance / raw `fetch` to the Nest API.
- Call sites: `api.get` / `api.post` / `api.patch` / `api.delete`. Interceptors handle envelope + errors.
- Shared HTTP contract types: `@cabin/api-contract` (envelope, codes, `StaffAdmin`, `AdminRole`) — do not duplicate cross-app types here.
- `withCredentials: true` (cookie `cabin.pms.sid`).
- `baseURL: "/api"` + audience-free paths (`/auth/...`, `/reservations/...`) → browser `/api/...`. Dev: Vite rewrites `/api` → Nest `/staff` (`VITE_API_URL`, default `http://localhost:3000`). Prod nginx: same (`location /api/` → `http://api:3000/staff/`). Nest still uses `/staff/...`; the audience prefix is not on the wire. Do **not** proxy Nest `/public` or `/health` through PMS — Phase 2 `web` rewrites `/api` → `/public` on its own origin.
- Success `{ data, meta? }` → interceptor sets `response.data` to unwrapped `data` → `(await api.get<T>(…)).data`.
- Errors `{ error: { code, message, details? } }` → throws `ApiError`. Also maps timeout / network / 502–504 to FE-only codes (`TIMEOUT`, `NETWORK_ERROR`, `SERVER_UNAVAILABLE`).
- Staff auth helpers: `staffLogin` / `staffLogout` / `staffSession` (thin `api.*` wrappers) — paths `/auth/*`.
- Staff admin helpers: `listAdmins` / `createAdmin` / `changeAdminRole` / `setAdminActive` (`/admins`, SUPER_ADMIN). Query key: `staffAdminsQueryKey`.
- Inventory helpers: `listProperties` / `listPropertyOptions` / `listUnitTypes` / `listUnits` (+ create/update/delete + detail GETs) under `/properties|unit-types|units`. Wire types `StaffProperty` / `StaffPropertyOption` / `StaffUnitType` / `StaffUnit`; lists are `Paginated<T>` (options = unpaginated `{ id, name }[]`).
- Media helpers: `createUploadIntent` / `uploadMediaFile` (`src/lib/api/media.ts`) — Nest signs Cloudinary upload; browser POSTs bytes to Cloudinary; never put `CLOUDINARY_API_SECRET` in Vite.
- SPA routes like `/properties` are UI-only — never invent unprefixed Nest paths.
- 401 hook: `setUnauthorizedHandler` (wired to `/login` via `UnauthorizedRedirect`). Session probe on login uses `{ skipUnauthorizedRedirect: true }`.
- Toasts: `handleSuccess` / `handleError` from screens/mutations — **not** inside the interceptor.
- Env: root `.env` → `VITE_API_URL` is the **proxy target only** (`vite.config` `envDir` = repo root).
- GET lists: Skeleton + `QueryRetryButton` on page-1 error; infinite lists use `InfiniteListFooter` (see `.cursor/rules/pms-ui.mdc`).

## Server state (TanStack Query)

Locked BE→FE wiring (keys, `useQuery` / `useInfiniteQuery` / `useMutation`, cache, toast vs field highlight): [`.cursor/rules/pms-query.mdc`](../../.cursor/rules/pms-query.mdc).

| Concern              | Rule                                                                |
| -------------------- | ------------------------------------------------------------------- |
| Query keys           | `src/lib/api/query-keys.ts` — import from `@/lib/api`               |
| Paginated lists      | `useInfiniteQuery` + `getNextPageParamFromPageInfo`; filters in key |
| List writes          | `invalidateQueries` on resource prefix + `handleSuccess`            |
| Mutation `onSuccess` | Clear local form/pending/picker state **first**, then cache + toast + close — see `pms-query.mdc` |
| Login / self-profile | `setQueryData(staffSessionQueryKey, …)`                             |
| Form domain errors   | `applyApiFieldError` → RHF (BE `details: { field, reason }`)        |
| Everything else      | `handleError` toast (or re-auth dialog / GET retry)                 |

## Forms

Use shadcn’s RHF pattern: `useForm` + `zodResolver` + `Controller` + `<Field />` (not the legacy `<Form>` wrapper). See [shadcn React Hook Form](https://ui.shadcn.com/docs/forms/react-hook-form). Zod bounds from `@cabin/api-contract`. Field names must match Nest DTO / `details.field`.

## Run

```bash
pnpm --filter @cabin/pms dev
pnpm --filter @cabin/pms typecheck
pnpm --filter @cabin/pms format
```

Add UI: from repo root → `pnpm dlx shadcn@latest add <component> -c apps/pms`

## Phase 1 screens (prod desk)

1. Staff login ← **done**
2. Inventory CRUD ← **done**
3. Calendar (busy/free per unit) ← **done** (Nest aggregate + blocks)
4. Manual reservations (Choose unit · rack Total · money/DP · boards on `/reservations`) ← **done** (Nest)
5. Check-in / check-out + Collect/Cancel ← **done** (detail + Arrivals/In-house/Departures boards; no `/check-in` route)
6. Basic reports ← **done** (Nest summary + PMS `/reports`)
7. iCal Sync now + `UNCONFIRMED` enrich queue ← board/warning UI only; Nest + feeds not yet

Optional: checklist “refresh OTA if urgent” (staff does it in the OTA UI — PMS does not remote-click).

## UX

- **Responsive web + mobile** — staff use desk and handheld; plan both from the start (`.cursor/rules/pms-ui.mdc`)
- Optimize for front-desk speed, not marketing
- Honor roles from API (`SUPER_ADMIN` | `ADMIN` | `FRONT_DESK`)
- Be honest about iCal delay; never promise zero conflicts
- iCal stubs need human enrich for guest + money — that is expected, not a bug

### UI skills (PMS only)

**Always use** — in order — from [`.cursor/skills/`](../../.cursor/skills/README.md). **Apply with judgment**; skills are defaults, not gospel. Full workflow + when to override: `.cursor/rules/pms-ui.mdc`.

| Order | Skill               | For                              |
| ----- | ------------------- | -------------------------------- |
| 1     | `shadcn`            | Add/compose shadcn components    |
| 2     | `product-ui-design` | Shipped admin look; anti AI-slop |

Do **not** load `ui-design-brain` / `ui-craft` / `ui-craft-dense-dashboard` for PMS — reserved for `apps/web` (Phase 2).

Anchor DNA: **Linear-dense / Stripe-data**. No purple gradients, glowing status dots, or landing-page hero patterns.

## Don’t

- Public guest browse/book flows (that’s `apps/web` Phase 2 — same API reservation model)
- Skip money/DP on staff reservation screens because “web will handle payment later”
- Call OTAs from the browser
- Invent local booking truth that bypasses the API
- Put tokens in `localStorage` (session cookie only)
- Use `npm i` inside this folder (pnpm from repo root only)

Root: `AGENTS.md` · Plan: `.docs/cabin-pms-client-plan.md` · Reservations: `_docs/reservations-design.md`
