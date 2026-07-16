# Primitives — concrete default values

Use these when you cannot measure a real reference. They are the "floor" defaults for restrained product UI. Adjust to the product's own brand, but stay inside the ranges.

## Color tokens (semantic, CSS variables)

Name by function, never by emotion. Never inline raw hex.

```css
:root {
  --background: #ffffff;        /* or a near-white tinted toward brand, e.g. #f7f8f7 */
  --surface:    #ffffff;        /* cards */
  --surface-2:  #f1f3f1;        /* one step down */
  --foreground: #1a1a1a;        /* near-black, NOT #000 */
  --muted:      #f4f4f5;
  --muted-foreground: #5b605b;  /* secondary text */
  --border:     #e4e7e4;        /* low-contrast: 5–10% darker than bg */
  --primary:    #16704a;        /* ONE brand accent from the product's world; not indigo */
}
```

Dark mode: near-black base (`#08090A`–`#0a0a0a`), and **lift elevation with surface lightness, not shadow** (Material-3 tonal overlay). Functional status colors (success/warning/danger/info) are counted separately from the 3-color budget.

Palette budget: monochrome base + **one** accent. Max 3 + neutrals total.

## Typography

- **One family.** System stack, Inter, Geist, or a real brand face. (Inter/system are correct for product UI — distinctive display faces belong to the ceiling, not here.)
- Body **14–17px** (shadcn 14, Apple 17). Line-height body **1.5–1.6**; large headings 1.0–1.2.
- Measure (line length) **45–75 characters**, `max-width: 65ch`.
- Hierarchy by **weight + muted color**, not size alone. Buttons weight 500–600 (not 700+; the text-link norm C below is the exception at 700).
- **`font-variant-numeric: tabular-nums`** on every number column / comparison.
- Real `…`, curly quotes `" "`, non-breaking spaces for units/shortcuts (`10&nbsp;MB`, `⌘&nbsp;K`).
- Letter-spacing: body 0–0.01em; ALL-CAPS labels 0.05–0.1em; large display headings −0.02em. Do not pad uppercase reflexively.

## Depth (shadows + radius)

- Shadow = **two layers** (a soft ambient + a tight occlusion), **tinted toward the background hue**, never pure black, opacity ~0.04–0.12:
```css
--shadow-1: 0 1px 2px rgba(26,40,30,.05), 0 1px 1px rgba(26,40,30,.04);
--shadow-2: 0 1px 2px rgba(26,40,30,.05), 0 4px 10px rgba(26,40,30,.07);
--shadow-pop: 0 2px 4px rgba(26,40,30,.06), 0 12px 28px rgba(26,40,30,.12);
```
- **Elevation levels**: functional UI uses 1–2; products with modals/popovers up to 3–5. (Levels = number of distinct elevations; layers = the 2 shadows composing each.)
- **Concentric radius**: inner radius ≤ outer; ideally `inner = outer − padding`. Never a large radius on a small element.
- Group with ONE method (border OR shadow OR fill), not all three.

## Button norms — pick ONE, commit per screen

| Norm | radius | weight | size | examples |
|---|---|---|---|---|
| A: Apple/HIG pill | 9999px | 400–510 | 14–17px | Apple, X, Spotify, Linear, Vercel |
| B: shadcn / Material 3 (default) | 8–12px | 500 | 14px, h 32–40px | shadcn, Cal.com, Notion, Arc |
| C: text-link | 0 | 700 | — | corporate/editorial |
| D: Stripe square | 4px | 600 | 16px | Stripe |

Variants of B: GitHub (6px / 500 / 14px), Resend (16px / 600). Do not mix norms in one screen. Primary uses the brand accent; in a **hero**, one decisive CTA + a quiet text link (not a reflexive filled+ghost pair). In **product chrome** (toolbars, dialog footers, table rows) a bordered secondary/tertiary button is correct and expected.

**Danger / destructive button** (red is a functional status color, counted separately from the 3-color budget):
```css
.btn-danger        { color: var(--danger-fg, #b42318); }              /* default: quiet, ghost */
.btn-danger:hover  { background: var(--danger-bg, #fbeceb); }
.btn-danger-solid  { background: var(--danger, #d92d20); color:#fff; } /* only the CONFIRMED action */
```
Keep the destructive action quiet until confirmation; the solid-red button appears in the confirm step, not on the resting screen.

### Icon button

(dense tables/toolbars need these constantly — reconcile small visual with 44px hit area):
```css
.iconbtn        { position:relative; width:28px; height:28px; display:grid; place-items:center;
                  border-radius:8px; color:var(--muted-foreground); }
.iconbtn:hover  { background:var(--surface-2); color:var(--foreground); }
.iconbtn::after { content:""; position:absolute; inset:-8px; }   /* 28 + 16 = 44px hit area */
```

## Status (no glowing dots)

A pill = shape + functional color + text. Example mapping for a workflow (the hexes below are **illustrative literals — map them to functional status tokens** like `--status-active-bg` in real code, per the no-raw-hex rule):

```css
.pill        { display:inline-flex; align-items:center; height:24px; padding:0 10px;
               border-radius:9999px; font-size:12px; font-weight:600; }
.pill.todo   { background:#eef1f4; color:#475569; }   /* slate */
.pill.active { background:#fdf3e7; color:#b45309; }   /* amber */
.pill.done   { background:#e9f5ec; color:#15803d; }   /* green */
.pill.closed { background:#f0f1f0; color:#6b7280; }   /* gray */
```

No `box-shadow` glow, no animated `●`. If a single indicator is truly needed, a solid (non-glowing) small shape is acceptable; a glow is not.

## Tables & data-dense surfaces

The headline product surface — get the defaults right:
- **Row height** 44–52px (comfortable) / 36–40px (dense). Pick one density and hold it.
- **Alignment**: text left, **numbers right + `tabular-nums`**, status/badges left or center. Headers align with their column's data.
- **Header**: small (12–13px), muted, medium weight; a single low-contrast bottom border, **not** a filled gray bar. Make it `position: sticky; top: 0` for long tables.
- **Separation**: prefer a hairline row border or generous padding over zebra striping; if zebra, keep it barely-there (2–4% tint). Never a colored left-rule per row unless it encodes meaning.
- **Sortable**: caret only on the active column; whole header is the click target; reflect sort in the URL.
- **Empty state**: never a blank table — short reason + one primary action.
- **Long content**: truncate with `…` (flex child `min-width:0`); the row stays one line — detail lives in the row's open/hover, not by wrapping.

## Settings, toggles & nav

- **Settings row**: label + description (muted, second line) on the left, control on the right, generous vertical padding; group into sections with a small section header and a divider — space between groups > within.
- **Switch vs checkbox**: switch = takes effect immediately; checkbox = applies on save/submit. Don't mix metaphors.
- **Sidebar nav**: 7–10 items max before grouping; icon + label; active item uses a muted accent-wash background, not a heavy fill; section labels are small/muted, not mono.

## Destructive & confirm

- **Reversible** (archive, hide) → act immediately + a toast with **Undo**. No dialog.
- **Irreversible** (delete account, revoke key) → a modal; for high blast-radius, **type-to-confirm** (retype the resource name). The danger-solid button is the modal's primary; **do not autofocus it** (focus Cancel or the input). Copy names the consequence ("This permanently revokes the key. Apps using it stop working.").
- **Sensitive values** (API keys, secrets): mask with `••••`, reveal a short tail for identification (`sk_live_…4f2a`), value in mono; **copy copies the full plaintext** even while masked; reveal is per-row and re-masks on blur.

## Spacing

4/8px scale: `4 8 12 16 24 32 48 64 96 128`. No two adjacent values closer than ~25%. Space **between** groups > space **within** groups. Page side margins: ≥16px mobile, ≥40px desktop. Avoid `py-32`+ extreme vertical padding. (The scale governs **gaps/padding between elements**, not fixed **component heights** — row heights, control heights follow their component specs above.)

## Motion

```css
--ease-out:   cubic-bezier(0.23, 1, 0.32, 1);
--ease-drawer:cubic-bezier(0.32, 0.72, 0, 1);
```
- UI reactions ≤ 300ms; large surfaces (modal/drawer/page) 200–500ms.
- Animate `transform` and `opacity` for **movement** (they composite, no repaint). Cheap **paint-only** props — `color`, `background-color`, `border-color`, `box-shadow` — are fine for **state** changes (hover, focus). Never animate **layout** props (`width`, `height`, `top`/`left`, `margin`, `padding`) and never `transition: all`.
- Enter from `scale(0.95)` + opacity, never `scale(0)`. Popovers origin-aware (`transform-origin` from trigger); modals center.
- `:active { transform: scale(0.97); }`. Exit faster than enter.
- **Frequency-gate**: high-frequency actions (command palette, shortcuts) get no open/close animation.
- `@media (prefers-reduced-motion: reduce)` → stop movement/position, keep opacity/color.

## Forms (forgiving)

- Never block paste; never `user-scalable=no`; inputs **16px** (prevents iOS auto-zoom).
- Don't block typing; validate after blur (touched fields) and on submit focus the first error.
- Correct `autocomplete` / `type` / `inputmode`; disable spellcheck on emails/codes; trim values.
- Placeholders show an example pattern and end with `…`. Keep submit enabled until the request starts, then disable + spinner (keep the label).
- `⌘/Ctrl+Enter` submits a textarea; `Enter` inserts a newline.

## Content resilience & a11y

- Layouts survive short and very long content: `truncate` / `line-clamp-*` / `break-words`; **flex children need `min-width:0`** to truncate.
- Reflect view state in the URL (filters/tabs/pagination) for share/refresh/back.
- Skeletons mirror the final layout (avoid layout shift).
- `:focus-visible` ring always. Don't rely on color alone for state (pair with text/icon). WCAG 2.2 AA contrast (4.5:1 text).
- **Hit targets**: WCAG 2.2 SC 2.5.8 (AA) requires **24×24 CSS px**; Apple HIG recommends **44×44pt**. Prefer 44px on touch UI; expand a small visual target with a pseudo-element (see the "Icon button" pattern under Button norms above).

## Reference DNA profiles (anti-monoculture)

The single token set above is a *floor*, not a destination — if every dashboard uses it, they all look identical (the skill's own sameness test would fail). When you can't measure a real product, **pick the profile that fits the domain and diverge from it**, don't average them:

| Profile | Feel | Type | Density | Accent use | Signature |
|---|---|---|---|---|---|
| **Linear-dense** | fast, keyboard-first, near-black even in light | Inter, 13–14px, tight | high (36px rows) | one cool accent, sparse | command-palette-first, monochrome discipline |
| **Stripe-data** | precise, financial, trustworthy | clean sans, tabular everywhere | medium | one precise brand color on primary only† | data typography, generous number formatting |
| **Notion-soft** | calm, document-like, warm neutrals | clean sans, ~16px, document-like | low, airy | minimal, grayscale-led | soft gray surfaces, gentle dividers |
| **Apple-airy** | premium, spacious, large hit areas | SF/system, 15–17px | low | restrained, system blue | big spacing, rounded, subtle depth |

State which profile you anchored to, then adapt its DNA to the product's own brand — that divergence is what makes the output *this* product, not a generic floor.

† A real brand color is a deliberate choice, **not** the reflexive `#6366f1` AI indigo the tell-list bans (Stripe's actual brand is blurple `#635BFF`). The ban targets *unowned* default indigo; a product whose real brand is in that hue, used as a single token on primary, is fine.

These profiles **deliberately step outside the floor's default ranges** (Linear's 13px body, Notion's airy density) — that is the point. The floor ranges (body 14–17px, etc.) apply when you are *not* anchoring to a profile; a chosen profile overrides them.
