#!/usr/bin/env bash
# Load repo root .env for VPS shell scripts (bash only).
# Skips comments and invalid keys — safe when .env has typos like "4NODE_ENV=...".

load_root_env() {
  if [ ! -f .env ]; then
    return 0
  fi
  set -a
  # shellcheck disable=SC1091
  source <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env | sed 's/\r$//')
  set +a
}
