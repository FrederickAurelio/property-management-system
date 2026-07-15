# @cabin/api-contract

Shared **HTTP wire contract** for Cabin frontends and the API.

## In

- Error codes, success/error envelope types, `isApiSuccessEnvelope`, `ApiError`

## Out

- Nest filters/interceptors, Prisma, React, fetch clients (those stay in apps)

## Use

```ts
import { ApiErrorCode, type ApiSuccess } from '@cabin/api-contract';
```

Depend with `"@cabin/api-contract": "workspace:*"`. `pnpm install` runs `prepare` → builds `dist/`.

General packages rules: [`../README.md`](../README.md) · [`.cursor/rules/monorepo-tooling.mdc`](../../.cursor/rules/monorepo-tooling.mdc).
