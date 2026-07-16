# AI-tell hard-checks (product UI)

Read this and scan your own output before finishing any product UI. These fire at *output time*, not from the prompt — run them yourself every time. Each row: the tell, why it reads as slop, and the correct replacement.

## Color

| Tell | Why it's slop | Replace with |
|---|---|---|
| Purple/blue accent (`#6366f1`, `#818cf8`, `#5B5BD6` family) | The default AI-startup color; instantly templated | One accent drawn from the product's own world; monochrome + that accent |
| Purple/blue radial **glow** or gradient mesh behind a hero | Generic "tech" atmosphere; the #1 visual tell | Flat near-black or near-white surface; if texture is needed, use a real SVG turbulence, not a glow |
| 4+ color palette | Loses control | Max 3 + neutrals; functional status colors counted separately |
| Emotion-named CSS variables (`--color-warmth`, `--color-trust`) | Not how real systems name tokens | Functional names (`--background`, `--foreground`, `--muted`, `--border`, `--primary`) |
| Raw hex inline instead of tokens | Unmaintainable; signals no system | CSS variables, defined once |
| Pure black `#000` for bg or text | Real products use near-black | `#1a1a1a`–`#08090A` (Linear `#08090A`, Apple `#1D1D1F`, Vercel `#171717`) |

## Status, badges, decoration

| Tell | Why it's slop | Replace with |
|---|---|---|
| **Glowing/pulsing `●` status dot** (eyebrow, badge, "● Live / Now in beta") | The single most common product-UI tell | A plain pill (shape + text) or a one-line note. No glowing dot, ever |
| Pill "eyebrow" badge (border + tint bg + tiny label) reflexively above every section | Generic AI hero furniture | Only where it earns its place; plain small label, letter-spacing 0–1px |
| Status/category color used as decoration | Pollutes the color vocabulary | Color only encodes meaning (status/severity/category); strip it from chrome otherwise |
| `SCROLL` / ↓ vertical scroll indicator | Template decoration; overlaps the CTA | Reveal a sliver of the next section, or nothing |
| Tech/SaaS chrome on a non-tech context ("● open now" live chip on a shop) | Context mismatch | Plain note ("Open 9–19, closed Tue") |

## Typography

| Tell | Why it's slop | Replace with |
|---|---|---|
| **Mono font on labels / eyebrows / section numbers / meta** | Mono is a data voice faked as "technical" | Sans for labels; mono only for real numbers/code/tabular |
| Bilingual double labels ("TYPEFACES／書体") | Redundant decoration | One language |
| Viewport-huge type (`text-9xl`, `text-[10vw]`) in product UI | Marketing register leaking into product | Body 14–17px; product headings stay modest |
| Serif italic as a heading subject | Doesn't exist in shipped product UI | Single family, weight for emphasis |
| Coloring one word of a heading | Decorative; not in product register | Weight/size hierarchy instead |
| `leading-none` to look dense | Crushes readability | Real line-height (body 1.5–1.6) |
| `...` three periods instead of `…` | Sloppy detail | Real ellipsis `…` |

## Layout, hierarchy

| Tell | Why it's slop | Replace with |
|---|---|---|
| **Filled + ghost hero button pair** (left filled, right outline) placed reflexively | The shadcn/landing template tell | One decisive CTA; secondary is a quiet text link |
| **Four equal stat cells** with big numbers + mono labels | The most templated AI-slop block (no focus, no theme) | Make one number the protagonist; others small and following |
| Icon-in-colored-circle 3× feature grid | Cookie-cutter | Earn each block; vary by content |
| Colored left-rule / top-border on every card or row by default | Admin-template fingerprint | Only when it encodes meaning; otherwise strip to neutral |
| Everything centered + no visual anchor | Text floats | Give a clear anchor and alignment |
| Extreme vertical padding (`py-32`/`py-40`) | Empty, slow | Standard `py-12`–`py-24`; build rhythm with internal padding |

## Depth, texture, motion

| Tell | Why it's slop | Replace with |
|---|---|---|
| Pure-black single-layer `box-shadow` | Cheap | Two layers (ambient + occlusion), tinted toward background hue, opacity ~0.04–0.12 |
| One element grouped by border + shadow + bg-fill at once | Visual noise | Pick one grouping method |
| High-contrast borders/dividers | Reads first, looks cheap | 5–10% darker than bg, ≤2 tones |
| Film grain, sepia, `mix-blend-difference`, decorative glassmorphism | Marketing/ceiling techniques in the floor | Remove from product UI |
| Custom cursor, parallax, 3D `preserve-3d`, scroll-hijack | Not in shipped product UI | Remove |
| Hover `scale`/`rotate`/`translate` (big) | Toy-like | Hover = opacity or shadow change |
| `transition: all` / animating layout props | Jank, lazy | `transform`/`opacity` for motion; cheap paint props (`color`/`bg`/`box-shadow`) OK for state; never layout props or `all` |
| Animating from `scale(0)` | Collapses in | `scale(0.95)` + opacity |
| Blanket `prefers-reduced-motion` kill (duration 0 on everything) | Too blunt | Stop movement/position; keep opacity/color fades |
| Animating high-frequency actions (command palette, shortcuts) | Annoying at repetition | No animation — frequency-gate |

## Finishing details (the micro-tells)

| Tell | Replace with |
|---|---|
| `:focus { outline: none }` with no replacement | `:focus-visible` ring (WCAG + polish) |
| Inputs under 16px on mobile | 16px to prevent iOS auto-zoom |
| Hit targets too small | WCAG 2.2 SC 2.5.8 (AA) requires **24×24 CSS px**; Apple HIG recommends **44×44pt**. Prefer 44px on touch UI; expand a small visual target with a pseudo-element |
| Number columns without `tabular-nums` | `font-variant-numeric: tabular-nums` |
| Flex child truncation not working | `min-width: 0` on the flex child |
| Skeleton that doesn't match final layout | Mirror final dimensions (avoid layout shift) |
| Generic button labels (Submit / OK) and errors (Something went wrong) | Verb-first specific labels; errors with cause + recovery |
| API key / secret rendered in plaintext at rest | Mask with `••••`, reveal a short tail (`sk_live_…4f2a`), value in mono, copy copies the full plaintext while masked |
| Abstract style words in your own reasoning (modern/clean/sleek) | Specific hex/px/real-product reference |
| Arbitrary off-grid padding (`p-[13px]`) | 4/8px multiples |
