# Cabin API — monorepo build (context = repo root)
# syntax=docker/dockerfile:1

# Optional mirrors (China demo VPS). Leave empty for Indo/MY/SG / official registries.
# APT_MIRROR=mirrors.aliyun.com
# NPM_REGISTRY=https://registry.npmmirror.com
ARG APT_MIRROR=
ARG NPM_REGISTRY=

# pnpm 11 needs Node >=22 (node:sqlite)
FROM node:22-bookworm-slim AS builder

ARG APT_MIRROR
ARG NPM_REGISTRY

WORKDIR /app

# apt mirror first; install pnpm via npm (corepack + npmmirror is unreliable)
RUN set -eux; \
  if [ -n "${APT_MIRROR}" ]; then \
    sed -i "s/deb.debian.org/${APT_MIRROR}/g" /etc/apt/sources.list.d/debian.sources; \
    sed -i "s/security.debian.org/${APT_MIRROR}/g" /etc/apt/sources.list.d/debian.sources; \
  fi; \
  apt-get update; \
  apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++; \
  rm -rf /var/lib/apt/lists/*; \
  if [ -n "${NPM_REGISTRY}" ]; then \
    npm install -g pnpm@11.3.0 --registry="${NPM_REGISTRY}"; \
    pnpm config set registry "${NPM_REGISTRY}"; \
  else \
    npm install -g pnpm@11.3.0; \
  fi; \
  # Weak VPS / China: pnpm default fetchTimeout=60s is too aggressive
  pnpm config set fetch-timeout 600000; \
  pnpm config set fetch-retries 5; \
  pnpm config set fetch-retry-mintimeout 20000; \
  pnpm config set fetch-retry-maxtimeout 120000; \
  pnpm config set network-concurrency 3

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/api-contract/package.json packages/api-contract/
COPY packages/ui-tokens/package.json packages/ui-tokens/
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

# Prod-only deploy bundle (~300MB vs copying full monorepo node_modules ~1.2GB+).
# --legacy: pnpm v10+ workspace deploy without inject-workspace-packages.
# prisma is a runtime dependency so migrate deploy has @prisma/engines + CLI.
WORKDIR /app
ENV CI=true
RUN set -eux; \
  pnpm deploy --filter=@cabin/api --prod --legacy /prod/api; \
  rm -rf /prod/api/src /prod/api/test

# --- runtime ---
FROM node:22-bookworm-slim AS runner

ARG APT_MIRROR

WORKDIR /app

RUN set -eux; \
  if [ -n "${APT_MIRROR}" ]; then \
    sed -i "s/deb.debian.org/${APT_MIRROR}/g" /etc/apt/sources.list.d/debian.sources; \
    sed -i "s/security.debian.org/${APT_MIRROR}/g" /etc/apt/sources.list.d/debian.sources; \
  fi; \
  apt-get update; \
  apt-get install -y --no-install-recommends openssl ca-certificates; \
  rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /prod/api ./

EXPOSE 3000

CMD ["node", "dist/main.js"]
