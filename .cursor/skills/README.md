# Project UI skills

One home: `.cursor/skills/` (no `.agents/` duplicate).

Impeccable install: `npx impeccable install --providers=cursor --scope=project` · update: `npx impeccable update`. Product record for customer FE: [`apps/web/PRODUCT.md`](../../apps/web/PRODUCT.md). Config: [`.impeccable/config.json`](../../.impeccable/config.json).

## By app

| App | Skills to use | Register |
|-----|----------------|----------|
| `apps/pms` | `shadcn` → `product-ui-design` only | Staff ops / admin (**Operate**) |
| `apps/web` (Phase 2) | **`impeccable`** (primary) · `ui-craft` / `ui-design-brain` as needed · `product-ui-design` for guest account chrome · `shadcn` only if adopted | Customer marketing (**Persuade**) + book flows (**Operate**) |

## Inventory

| Skill | Source | Role |
|-------|--------|------|
| `impeccable` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0) | Design vocabulary, anti-slop detectors, live iteration — **primary for `apps/web`** |
| `shadcn` | [shadcn/ui](https://ui.shadcn.com/docs/skills) | Install/compose shadcn components |
| `product-ui-design` | [kuras3/product-ui-design](https://github.com/kuras3/product-ui-design) (MIT) | Restrained admin / account chrome; kill AI-slop tells |
| `ui-design-brain` | [carmahhawwari/ui-design-brain](https://github.com/carmahhawwari/ui-design-brain) (MIT) | 60+ component patterns (support for `web`) |
| `ui-craft` | [educlopez/ui-craft](https://github.com/educlopez/ui-craft) (MIT) | Broader craft / anti-slop (support for `web`) |
| `ui-craft-dense-dashboard` | same | Dense data UI when needed (rare on `web`) |

## Rules of thumb

- PMS must **not** load `impeccable` / `ui-design-brain` / `ui-craft*` unless explicitly asked — keep the admin register.
- `web` marketing heroes: **Impeccable**, not `product-ui-design`.
- Refresh customer product truth with `/impeccable init` after client brief; create `DESIGN.md` when visual work starts (not before brand answers).
