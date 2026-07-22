# Cabin API — monorepo build (context = repo root)
# syntax=docker/dockerfile:1

# pnpm 11 needs Node >=22 (node:sqlite)
FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.3.0 --activate \
  && apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/api-contract/package.json packages/api-contract/
COPY apps/api/package.json apps/api/
COPY apps/pms/package.json apps/pms/
COPY apps/web/package.json apps/web/

# Skip prepare/postinstall until sources are present
RUN pnpm install --frozen-lockfile --filter @cabin/api... --ignore-scripts

COPY packages/api-contract packages/api-contract
COPY apps/api apps/api

RUN pnpm --filter @cabin/api-contract build \
  && pnpm rebuild bcrypt

# prisma generate does not need a live DB
ENV DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/cabin_pms?schema=public
WORKDIR /app/apps/api
RUN pnpm exec prisma generate
RUN pnpm run build

# --- runtime ---
FROM node:22-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable && corepack prepare pnpm@11.3.0 --activate

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/api-contract ./packages/api-contract
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["node", "dist/main"]
