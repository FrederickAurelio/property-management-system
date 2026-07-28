# @cabin/ui-tokens

Shared **design tokens** (CSS variables + Tailwind v4 `@theme` bridges) for `apps/pms` and `apps/web`.

Template palette for now (oklch from PMS radix-nova). Not final brand — replace values here when client `DESIGN.md` lands; both apps inherit.

## In

- `:root` / `.dark` semantic colors, radius, shadows, font family **names**
- `@theme inline` mappings so Tailwind utilities (`bg-primary`, …) resolve

## Out

- React / shadcn components (each app owns `components/ui`)
- Font **files** (each app `@import`s `@fontsource-*`)
- Wire/API types (`@cabin/api-contract`)
- App-local layout chrome

## Use

```css
@import "tailwindcss";
@import "@cabin/ui-tokens/tokens.css";
@import "@cabin/ui-tokens/theme.css";
```

```json
"@cabin/ui-tokens": "workspace:*"
```

## Don’t

- Put tokens in `@cabin/api-contract`
- Duplicate `:root` primary/background in an app once this package owns them
- Premature `packages/ui` for shared React — extract only when the same primitive is copy-pasted 2+ times and stays identical

Root packages rules: [`../README.md`](../README.md).
