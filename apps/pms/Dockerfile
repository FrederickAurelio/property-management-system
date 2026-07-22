# Cabin PMS — Vite build + nginx (context = repo root)
# syntax=docker/dockerfile:1

# Optional mirrors (China demo VPS). Leave empty for Indo/MY/SG / official registries.
# APT_MIRROR unused here (no apt). NPM_REGISTRY speeds pnpm/corepack in China.
ARG APT_MIRROR=
ARG NPM_REGISTRY=

# pnpm 11 needs Node >=22 (node:sqlite)
FROM node:22-bookworm-slim AS builder

ARG NPM_REGISTRY

WORKDIR /app

RUN set -eux; \
  if [ -n "${NPM_REGISTRY}" ]; then \
    export COREPACK_NPM_REGISTRY="${NPM_REGISTRY}"; \
  fi; \
  corepack enable && corepack prepare pnpm@11.3.0 --activate; \
  if [ -n "${NPM_REGISTRY}" ]; then \
    pnpm config set registry "${NPM_REGISTRY}"; \
  fi

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/api-contract/package.json packages/api-contract/
COPY apps/api/package.json apps/api/
COPY apps/pms/package.json apps/pms/
COPY apps/web/package.json apps/web/

# Skip prepare until api-contract sources are present
RUN pnpm install --frozen-lockfile --filter @cabin/pms... --ignore-scripts

COPY packages/api-contract packages/api-contract
COPY apps/pms apps/pms

RUN pnpm --filter @cabin/api-contract build
RUN pnpm --filter @cabin/pms build

# --- nginx ---
FROM nginx:1.27-alpine AS runner

COPY apps/pms/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/pms/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
