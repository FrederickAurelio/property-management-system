# Cursor rules layout

Layered **glob** rules under `.cursor/rules/`. Entry files apply to the whole app; concern files add context when matching paths are open.

## Always on

| File | Role |
|------|------|
| `agents-writing.mdc` | How to write AGENTS + rules |
| `monorepo.mdc` | Architecture, phase, hard stops |
| `monorepo-tooling.mdc` | pnpm, ESLint CWD, packages, Prisma output |
| `monorepo-eslint-types.mdc` | `no-unsafe-*` floods, workspace package resolution, trust CLI over IDE |
| `commits.mdc` | Conventional commits + husky |

## Per app — entry + concerns

| App | Entry (`apps/<app>/**`) | Concern files (tighter globs) |
|-----|--------------------------|-------------------------------|
| `api` | `api.mdc` | `api-http`, `api-prisma`, `api-auth`, `api-audience` · *slot:* `api-domain` for deep domain patterns if needed |
| `pms` | `pms.mdc` | `pms-api`, `pms-query`, `pms-ui` |
| `web` | `web.mdc` | `web-ui` · *slot:* `web-api` when public API client code lands |

Deep playbook: `apps/<app>/AGENTS.md`. Add a concern `.mdc` only when [agents-writing.mdc](agents-writing.mdc) scaling criteria apply.
