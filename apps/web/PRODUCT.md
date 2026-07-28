# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: leisure / stay guests researching and booking a cabin or apartment stay directly on the property’s public site (not staff). Secondary: returning guests who need to view a booking or request a change — **scope undecided** until client cancel / change-date / refund policy is confirmed.

Staff front desk is **out of scope** here (`apps/pms`).

## Product Purpose

Public browse + book path into the existing Cabin PMS reservation domain. Guests see real availability from Nest `apps/api`, create stays with `source=WEBSITE`, and (when policies allow) manage stay requests. Success = trustworthy direct bookings without inventing a second booking or payment database.

## Positioning

Direct booking on the owner’s brand — same ops truth as OTA/manual stays in Phase 1 PMS. Not a Channel Manager UI and not a staff desk.

## Operating Context

- Phase 1 staff PMS already runs live OTA + manual reservations (money/DP, calendar, iCal).
- Guests today often arrive via OTA, WhatsApp, or walk-in; organic SEO importance is **open** (client discovery).
- Bookings write Nest `/public/...` → `domain/reservations` (same Total / Paid / movements model).
- PMS iCal export hub blocks OTAs after website books.

## Capabilities and Constraints

**Confirmed (engineering):**

- Stack: Vite + React + TypeScript · Tailwind CSS v4 · shadcn/ui (radix-nova) · `@cabin/ui-tokens` · i18n en/id/zh; prerender/SSG for marketing + public listing HTML (SEO without required per-request SSR). Book / account flows may stay CSR.
- One Nest API; browser `/api/...` → Nest `/public/...` on the web origin. Never call `/staff`.
- No Next.js unless SEO-led growth + ops appetite for a Node FE is explicitly chosen later.
- Public site sits behind a CDN (Cloudflare free default) caching static assets; never cache `/api/`.
- Guest cancel / refund / change-date **self-serve** only after client policy is locked; until then staff paths in PMS remain the ops source of truth.
- Locales scaffolded: **en** / **id** / **zh** (`i18next`); copy and default marketing language still open until client brief.

**Open (client discovery — do not invent):**

- Brand name, voice, photography, location copy
- Exact unit inventory story (cabin vs apt, count, amenities)
- Default / primary marketing language among en · id · zh
- Payment path (DP, full pay, gateway vs transfer)
- Cancel / change-date / refund rules and deadlines
- Whether Google organic search is a primary acquisition channel

## Brand Commitments

None confirmed yet. Do not invent property names, testimonials, or “luxury cabin” tropes. Run `/impeccable init` update after client brief; create `DESIGN.md` via `/impeccable` new-work / `document` when UI work starts.

## Evidence on Hand

- Repo product plan: `.docs/cabin-pms-client-plan.md`
- Reservation/money domain: `_docs/reservations-design.md`
- Staff ops UI (anti-reference for marketing register): `apps/pms`
- No client brand kit or production photos in-repo yet — do not fabricate guest reviews or occupancy claims

## Product Principles

1. One reservation truth — website books the same domain staff already run.
2. Persuade on marketing surfaces; Operate on book / manage-stay flows — never mix registers carelessly.
3. Honest availability and money — no fake inventory, no second ledger.
4. Client brief beats aesthetic defaults — open brand fields stay open until answered.
5. SEO HTML where public pages must rank; SPA is fine for authenticated or wizard steps.

## Accessibility & Inclusion

Aim for WCAG AA on guest flows (contrast, focus, keyboard, semantic HTML). Ship UI strings via i18n (**en** / **id** / **zh**); primary marketing locale open until client answers.
