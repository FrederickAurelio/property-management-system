# Cursor rules layout

Layered **glob** rules under `.cursor/rules/`. Entry files apply to the whole app; concern files add context when matching paths are open.

## Always on

| File | Role |
|------|------|
| `monorepo.mdc` | Architecture, phase, hard stops |
| `monorepo-tooling.mdc` | pnpm, packages, Prisma output, IDE CWD pointer |
| `commits.mdc` | Conventional commits + husky |

Globbed (not every turn): `agents-writing.mdc` (when editing AGENTS / rules) · `monorepo-eslint-types.mdc` (when editing ESLint / tsconfig / workspace).

## Per app — entry + concerns

| App | Entry (`apps/<app>/**`) | Concern files (tighter globs) |
|-----|--------------------------|-------------------------------|
| `api` | `api.mdc` | `api-http`, `api-throttle`, `api-prisma`, `api-auth`, `api-audience`, `api-integrations` · *slot:* `api-domain` for deep domain patterns if needed |
| `pms` | `pms.mdc` | `pms-api`, `pms-query`, `pms-ui`, `pms-effects` |
| `web` | `web.mdc` | `web-ui` · *slot:* `web-api` when public API client code lands |

Deep playbook: `apps/<app>/AGENTS.md`. Add a concern `.mdc` only when [agents-writing.mdc](agents-writing.mdc) scaling criteria apply.
