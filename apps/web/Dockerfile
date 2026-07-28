# Cabin Web — Vite build + nginx (context = repo root)
# syntax=docker/dockerfile:1

# Optional mirrors (China demo VPS). Leave empty for Indo/MY/SG / official registries.
# NPM_REGISTRY=https://registry.npmmirror.com
ARG APT_MIRROR=
ARG NPM_REGISTRY=

# pnpm 11 needs Node >=22 (node:sqlite)
FROM node:22-bookworm-slim AS builder

ARG NPM_REGISTRY

WORKDIR /app

# Install pnpm via npm (corepack + npmmirror is unreliable)
RUN set -eux; \
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

# Skip prepare until api-contract sources are present
RUN pnpm install --frozen-lockfile --filter @cabin/web... --ignore-scripts

COPY packages/api-contract packages/api-contract
COPY packages/ui-tokens packages/ui-tokens
COPY apps/web apps/web

RUN pnpm --filter @cabin/api-contract build
RUN pnpm --filter @cabin/web build

# --- nginx ---
FROM nginx:1.27-alpine AS runner

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
