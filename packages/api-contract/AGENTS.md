# @cabin/api-contract

Shared **HTTP wire contract** for Cabin frontends and the API.

## Layout

```text
src/
  index.ts          # public barrel — import only from @cabin/api-contract
  envelope.ts       # success/error body shapes + isApiSuccessEnvelope
  error-codes.ts    # ApiErrorCode
  api-error.ts      # ApiError (FE client throw type)
  admin.ts          # AdminRole, PublicAdmin
```

## In

- Envelope types, error codes, `ApiError`, staff wire types (`AdminRole`, `PublicAdmin`)

## Out

- Nest filters/interceptors, Prisma, React, fetch clients (those stay in apps)

## Use

```ts
import { ApiErrorCode, type PublicAdmin } from '@cabin/api-contract';
```

Depend with `"@cabin/api-contract": "workspace:*"`. `pnpm install` runs `prepare` → builds **dual** `dist/cjs` (Nest `require`) + `dist/esm` (Vite named `import`). Package `exports` nest `types` under both `import` and `require` so type-only members (`PublicAdmin`, etc.) resolve in the IDE.

General packages rules: [`../README.md`](../README.md) · [`.cursor/rules/monorepo-tooling.mdc`](../../.cursor/rules/monorepo-tooling.mdc).
