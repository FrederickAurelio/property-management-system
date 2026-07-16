---
name: product-ui-design
description: Build functional product UI — dashboards, SaaS tools, settings, app screens, admin panels, data tables, forms — that looks like a real shipped product (Apple / Linear / shadcn register), not generic AI slop. Enforces restraint, kills AI-tell signals (glowing status dots, mono eyebrow labels, purple-blue accents, filled+ghost hero button pairs, four-cell stat strips), and grounds choices in observation of real products. Use when the user asks for product/app/dashboard/admin/internal-tool UI. For expressive marketing or landing-page aesthetics, use frontend-design instead.
---

# Product UI without the AI tells

This skill builds **restrained, production-grade product UI**: the register of Apple, Linear, Stripe dashboard, shadcn/ui, Vercel, GitHub, Notion — interfaces that look like a real team shipped them. It is the counterpart to maximalist marketing design. The goal is not to be unforgettable; it is to be **correct, calm, and free of the signals that mark a UI as AI-generated**.

AI models, left to default, converge on a recognizable "slop" look for product UI: purple-blue gradients, glowing status dots, mono labels used as decoration, evenly-timid palettes, four identical stat cells, a filled+ghost button pair in every hero. This skill prevents that by combining three disciplines: **observe before you invent**, **a two-layer floor/ceiling model**, and **output-time hard-checks** against a list of known tells.

## When to use / when NOT to use

- **Use this skill** for functional/product UI where looking *shipped and trustworthy* matters more than looking *expressive*: dashboards, SaaS app screens, settings, admin panels, data tables, forms, internal tools, B2B.
- **Do NOT use this skill** for expressive marketing pages, brand/landing heroes, campaign sites, or anything whose job is to be a memorable artifact — that is a different register (commit boldly, distinctive type, atmosphere). Use a marketing/expressive-design skill instead (e.g. `frontend-design`).
- **vs a generalist UI skill** (e.g. `ui-ux-pro-max`): use this one when the priority is restraint and killing AI tells on a *shipped product surface*; use a generalist for broad style/palette/chart exploration.
- **Composes with** a motion-craft skill (e.g. `emil-design-eng`) and an a11y/review skill — this skill owns the *restraint + tell-scan* layer, not all of design.
- Most real products contain **both**: a marketing surface (ceiling) and a product surface (floor). This skill governs the product surface. See "Floor and ceiling" below.

## The three disciplines

### 1. Observe before you invent

Do not generate values from memory. Real product UIs have measurable DNA. **Default to anchoring on a real reference**, not a generic average — otherwise every output converges on the same near-black/Inter/shadcn look (tell-free, but monocultural). Two ways to anchor:

1. **Measure** (best): open a real reference in browser devtools / `getComputedStyle` and read font family/size/weight/line-height, exact hex of background/text/border/accent, button padding/radius/height, section spacing, shadow composition.
2. **Pick a profile** (when you can't measure): choose a named product DNA that fits the domain and diverge from it — see "Reference DNA profiles" in `references/primitives.md` (Linear-dense / Stripe-data / Notion-soft / Apple-airy). State which you chose.

`references/primitives.md` is the fallback floor, not the goal. "Roughly modern and clean" is how slop is born; a specific named reference is how shipped UI is born. **Tell-free is what this skill guarantees; *good* comes from the reference you anchor to** — don't skip this step.

Make the anchor explicit and non-skippable: write it as a comment at the top of the file — `/* anchor: <reference/profile>, diverge: <what you changed for this product> */`. If you can't write that line, you anchored to nothing. A full worked example (anchor → diverge → annotated build) is in `references/example.md`.

### 2. Floor and ceiling (two-layer discipline)

Every product has two registers. Knowing which you are in prevents both timidity and slop.

- **Floor (this skill's default)** — the functional layer: body text, data, navigation, controls, forms, tables. Here, **correct and calm wins**. Near-black not pure black. Hierarchy by weight and color, not size. One accent, used for meaning. No decoration that competes with function.
- **Ceiling** — the expressive layer: a marketing hero, an onboarding moment, a brand splash. Here, character is allowed (bold type, atmosphere, motion as a subject). When a product needs a ceiling, switch registers deliberately — but **never let ceiling techniques (grain, glow, gradient mesh, custom cursors) leak into the floor.** Those are exactly the AI tells in product UI.

If you are unsure which register you are in, you are in the floor. Default to restraint.

### 3. Output-time hard-checks

Before you present any UI, **scan your own output** for the known tells. These fire at *output time*, not from the prompt — so you must run them yourself every time. The critical few, inline:

- **No glowing/pulsing status dots.** The small `●` with a `box-shadow` glow on an eyebrow, badge, or "● Live / Now in beta" label is the single most common product-UI tell. Show status with a plain pill (shape + text) or a one-line note. Never a glowing dot.
- **No mono font on labels / eyebrows / section numbers / meta.** Monospace is a *data voice* (numbers, code, tabular). Using it on labels to look "technical" is a tell. Convert label/eyebrow/heading mono to sans.
- **No purple-blue AI accent** (`#6366f1` / `#818cf8` family) or purple radial glow. Pick a brand accent from the product's own world; monochrome + one considered accent beats the default indigo.
- **No *reflexive* filled+ghost hero button pair** (left filled-primary / right outline-ghost) placed by habit in a hero. In a hero, use a single decisive CTA + a quiet text link. (Bordered secondary/tertiary buttons *are* correct in product chrome — toolbars, dialog footers, table rows; the ban is the reflex, not the pattern.)
- **No four-equal-cell stat strip when the cells aren't true peers.** Make one number the protagonist and let the rest follow small. (Four equal KPIs are fine *when the four metrics genuinely are equal peers*.)
- **No film grain, glow, radial-gradient atmosphere, custom cursor, parallax** in the product floor.
- **No pure black** (`#000`) for background or text — use near-black (`#1a1a1a`–`#08090A` range). **No single-layer pure-black box-shadow** — use multi-layer shadows tinted toward the background hue.

The checklist is in `references/ai-tells.md`. Read it before finishing any UI. An optional mechanical gate (`scripts/scan-tells.py`) greps generated CSS **and Tailwind classes** for the machine-detectable tells (indigo accent, pure-black text/bg/shadow — including token colors/shadows, arbitrary-value `bg-[#000]`, and modern `rgb(0 0 0)` syntax, `transition: all`, `scale(0)`, zoom-disable, focus-without-ring, sub-16px inputs).

## Positive defaults (replace every tell with a primitive)

Bans alone let the slop flow back in. For each tell there is a correct default — full values in `references/primitives.md`:

- **Color**: monochrome base + one accent (max 3 + neutrals; functional status colors counted separately). Semantic CSS-variable tokens (`--background`, `--foreground`, `--muted`, `--border`, `--primary`), never emotion names, never raw hex inline.
- **Type**: a single family (system / Inter / Geist / a real brand face). Body 14–17px. Hierarchy via weight and muted color, not just size. Tabular-nums on every number column. Real ellipsis `…`, curly quotes, non-breaking spaces for units/shortcuts (`10 MB`, `⌘ K`).
- **Depth**: near-black surfaces; shadows are two layers (a soft ambient + a tight occlusion), tinted toward the background hue, never pure black; concentric radius (inner ≤ outer); in dark mode lift with surface lightness, not shadow.
- **Buttons**: pick ONE norm and commit — Apple pill / shadcn 8–12px / Stripe 4px / text-link. Do not mix norms in one screen.
- **Status**: pill (shape + text) with a functional color, not a glowing dot.
- **Motion**: see "Interaction craft" — restrained, frequency-gated, transform/opacity only.

## Interaction craft (the details that read as "real")

For general **motion craft** (easing, `scale(0.95)` not `scale(0)`, `:active` scale, origin-aware popovers, transform/opacity only, `prefers-reduced-motion` = keep opacity), defer to a dedicated motion skill (e.g. `emil-design-eng`) or `references/primitives.md`. Concrete values are in primitives. The product-floor-specific judgment this skill adds:

- **Frequency-gate animation.** Actions done dozens of times a day in dense product UI (a command palette toggle, a keyboard shortcut, a row expand) should have **no** open/close animation. The highest craft in a tool is often *not* animating — the opposite instinct from marketing UI.
- **Forms are forgiving**: never block paste, never disable zoom (16px inputs prevent iOS auto-zoom), don't block typing (validate after, focus the first error on submit), set correct `autocomplete`/`type`/`inputmode`, placeholders show an example pattern, keep submit enabled until the request starts.
- **Content resilience**: layouts survive short and very long content (`truncate`/`line-clamp`/`break-words`; flex children need `min-width:0`); reflect view state in the URL; skeletons mirror the final layout.
- **Destructive actions**: reversible → inline disclosure; irreversible → modal with type-to-confirm; the danger button is deliberate (not default focus); copy states the blast radius. Values in `references/primitives.md` ("Destructive & confirm").

## Self-check before presenting

Run these honestly — the first four always, the fifth when you want a mechanical backstop:

1. **Tell scan** — read `references/ai-tells.md` and grep your own output for every tell. Fix each.
2. **Swap test** — if you swapped the type and accent for the generic defaults, would anything change? If not, you defaulted.
3. **Token test** — read your CSS variable names aloud. Do they belong to *this* product's world, or any project?
4. **Sameness test** — would another AI, given the same prompt, produce substantially the same output? If yes, you fell through to the generic floor; anchor to a real reference (discipline 1) and diverge.
5. **Mechanical gate (optional)** — run `scripts/scan-tells.py <file-or-dir>` to grep for machine-detectable tells. A passing scan is necessary, not sufficient — it catches the obvious, not taste.

Honesty about scope: a clean scan + these tests guarantee a **tell-free, correct floor** — roughly "looks like a competent team shipped it." Genuinely *distinctive* product UI (Linear, Stripe) comes from the reference you anchored to and the hierarchy/density decisions for *this* product, not from the checklist.

## Reference files

- `references/ai-tells.md` — the output-time hard-check list (read before finishing any UI).
- `references/primitives.md` — concrete default values: tokens, type scale, shadow recipes, button norms, status/table/settings patterns, destructive actions, reference DNA profiles.
- `references/example.md` — one fully worked build (anchor → diverge → annotated code) showing the generative path end to end.
- `scripts/scan-tells.py` — optional mechanical gate (no dependencies; scans CSS/HTML/JSX and Tailwind classes for indigo, pure-black text/bg/shadow incl. token colors and arbitrary `bg-[#000]`, `transition:all`, `scale(0)`, zoom-disable, focus-without-ring, sub-16px inputs).
