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
  fi

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

ARG APT_MIRROR
ARG NPM_REGISTRY

WORKDIR /app

RUN set -eux; \
  if [ -n "${APT_MIRROR}" ]; then \
    sed -i "s/deb.debian.org/${APT_MIRROR}/g" /etc/apt/sources.list.d/debian.sources; \
    sed -i "s/security.debian.org/${APT_MIRROR}/g" /etc/apt/sources.list.d/debian.sources; \
  fi; \
  apt-get update; \
  apt-get install -y --no-install-recommends openssl ca-certificates; \
  rm -rf /var/lib/apt/lists/*; \
  if [ -n "${NPM_REGISTRY}" ]; then \
    npm install -g pnpm@11.3.0 --registry="${NPM_REGISTRY}"; \
  else \
    npm install -g pnpm@11.3.0; \
  fi

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
