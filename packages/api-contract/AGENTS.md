# @cabin/api-contract

Shared **HTTP wire contract** for Cabin frontends and the API.

## Layout

```text
src/          ← TypeScript source only (.ts)
dist/cjs/     ← CJS emit (Nest)
dist/esm/     ← ESM emit (Vite)
scripts/      ← clean-src-artifacts.mjs (strips stray emit in src/)
```

**Never** commit or keep `.js` / `.d.ts` / `.js.map` under `src/`. Build only via `pnpm run build` (runs `clean:src-artifacts` first). If junk reappears after IDE compile or a mistaken `tsc` on a single file, run `pnpm --filter @cabin/api-contract run clean:src-artifacts`.

## In

- Envelope types, error codes, `ApiError`, staff wire types (`AdminRole`, `PublicAdmin`)
- Staff credential limits + structured field-error reasons for forms

## Out

- Nest filters/interceptors, Prisma, React, fetch clients (those stay in apps)

## Use

```ts
import { ApiErrorCode, type PublicAdmin } from '@cabin/api-contract';
```

Depend with `"@cabin/api-contract": "workspace:*"`. `pnpm install` runs `prepare` → builds **dual** `dist/cjs` (Nest `require`) + `dist/esm` (Vite named `import`). Package `exports` nest `types` under both `import` and `require` so type-only members (`PublicAdmin`, etc.) resolve in the IDE.

General packages rules: [`../README.md`](../README.md) · [`.cursor/rules/monorepo-tooling.mdc`](../../.cursor/rules/monorepo-tooling.mdc).
