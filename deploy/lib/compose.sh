#!/usr/bin/env bash
# Shared docker compose helper for VPS shell scripts.
# Requires bash 4+. Tested targets: Ubuntu, Debian, Alibaba Linux, RHEL-family VPS.
#
# Caller sets optional COMPOSE_FILE_ARGS (space-separated -f flags), then:
#   compose_read_args
#   compose_ensure          # exits 1 if neither v2 plugin nor v1 binary exists
#   compose exec -T postgres ...

compose_read_args() {
  COMPOSE_ARGS=()
  if [ -n "${COMPOSE_FILE_ARGS:-}" ]; then
    read -r -a COMPOSE_ARGS <<< "${COMPOSE_FILE_ARGS}"
  fi
}

compose_bootstrap_if_missing() {
  if docker compose version >/dev/null 2>&1; then
    return 0
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    return 0
  fi
  if ! command -v docker >/dev/null 2>&1; then
    echo "compose: docker is not installed" >&2
    return 1
  fi
  if ! command -v curl >/dev/null 2>&1; then
    echo "compose: need 'docker compose' v2 plugin or legacy docker-compose on PATH" >&2
    return 1
  fi

  # Same bootstrap as deploy-vps-main.yml (Ubuntu apt docker-compose v1 breaks on Engine 25+).
  mkdir -p "${HOME}/.docker/cli-plugins"
  curl -fsSL "https://github.com/docker/compose/releases/download/v5.4.0/docker-compose-linux-$(uname -m)" \
    -o "${HOME}/.docker/cli-plugins/docker-compose"
  chmod +x "${HOME}/.docker/cli-plugins/docker-compose"
  docker compose version >/dev/null 2>&1
}

compose_ensure() {
  if docker compose version >/dev/null 2>&1; then
    return 0
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    return 0
  fi
  echo "compose: need 'docker compose' v2 plugin or legacy docker-compose on PATH" >&2
  echo "compose: on deploy, compose_bootstrap_if_missing may install the v2 plugin" >&2
  return 1
}

compose() {
  if docker compose version >/dev/null 2>&1; then
    if [ "${#COMPOSE_ARGS[@]}" -gt 0 ]; then
      docker compose "${COMPOSE_ARGS[@]}" "$@"
    else
      docker compose "$@"
    fi
    return
  fi

  if [ "${#COMPOSE_ARGS[@]}" -gt 0 ]; then
    docker-compose "${COMPOSE_ARGS[@]}" "$@"
  else
    docker-compose "$@"
  fi
}
