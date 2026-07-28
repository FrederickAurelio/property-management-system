# packages/

Shared libraries for **two or more apps**. Not a junk drawer for one app’s internals.

## When code belongs here

| Put in `packages/` | Keep in `apps/` |
|--------------------|-----------------|
| Types / constants / pure helpers used by 2+ apps | Nest modules, guards, controllers |
| Stable cross-app contracts (API wire shapes, shared enums) | React/Vite UI, routing |
| Small isomorphic utilities (no Nest/React/Prisma imports) | Prisma schema, DB access, env boot |

**Trigger:** you are about to paste the same file into a second app → stop and add or extend a package instead.

## How to add a package

1. Create `packages/<name>/` with `package.json` (`name`: `@cabin/<name>`), `tsconfig.json`, `src/`.
2. Emit build output apps can load (typical: `dist/` + `"prepare": "pnpm run build"`). CSS-only packages may export `src/` with no build.
3. Document the package in its own short `AGENTS.md` (what’s in / what’s out).
4. In each consumer: `"@cabin/<name>": "workspace:*"` → `pnpm install` from **repo root**.
5. Import `@cabin/<name>` only — never `../../apps/...`.
6. Ensure root `typecheck` builds packages that need `dist/` before app checks.
7. **Docker (required):** app Dockerfiles use a two-phase COPY — `package.json` only before `pnpm install`, then sources before build. Update every image that installs the workspace:

| When | Update |
|------|--------|
| New `packages/<name>` | All of `apps/api`, `apps/pms`, `apps/web` Dockerfiles: add `COPY packages/<name>/package.json packages/<name>/` next to the other package.json copies |
| App depends on the package at build time | That app’s Dockerfile: also `COPY packages/<name> packages/<name>` before `pnpm --filter @cabin/<app> build` (and run package `build` first if it emits `dist/`) |
| New app image | Mirror an existing FE/API Dockerfile; include **every** current `packages/*/package.json` in the install layer |

Skipping step 7 breaks VPS/GHCR builds while local `pnpm` still works.

## Inventory

| Package | Purpose |
|---------|---------|
| [`@cabin/api-contract`](api-contract/) | HTTP envelope, error codes, staff + inventory wire types, pagination (`Paginated`) |
| [`@cabin/ui-tokens`](ui-tokens/) | Shared CSS design tokens + Tailwind `@theme` for `pms` + `web` (not React components) |

Add rows when new packages appear. Details for each package live in that package’s `AGENTS.md`.

**UI sharing rule:** tokens in `@cabin/ui-tokens`; shadcn/React components stay **per app** until the same primitive is copy-pasted and must stay identical — then consider `packages/ui`. Do **not** put CSS or components in `@cabin/api-contract`.
