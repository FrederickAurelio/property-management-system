# Request logs — Loki

Nest HTTP lines live in Loki. Nest **pushes** JSON to `LOKI_URL`; **PMS Request logs** (`/request-logs`, ADMIN+) is the query UI. Loki is unpublished on VPS; local compose binds `127.0.0.1:3100` so host Nest can push and query.

Image pins and compose: [`docker-compose.yml`](../../docker-compose.yml) (VPS) · [`docker-compose.dev.yml`](../../docker-compose.dev.yml) (local). Design: [`_docs/request-logs.md`](../../_docs/request-logs.md).

---

## Access

| Where | What |
|-------|------|
| PMS | Settings → Request logs (`/request-logs`, ADMIN+) |
| Local Loki (`pnpm logs:up`) | `http://127.0.0.1:3100` — Nest only, not a browser UI |
| VPS | Loki unpublished. Nest uses `LOKI_URL=http://loki:3100` on `cabin-net` |

Retention: **30 days** (`deploy/loki/loki.yaml`).

---

## Local commands

```bash
pnpm logs:up
pnpm logs:down
pnpm logs:logs
```

Requires root `.env` `LOKI_URL=http://127.0.0.1:3100` (host Nest). VPS compose overrides `LOKI_URL` to `http://loki:3100`.

If a leftover `cabin-alloy-data` volume remains after deploy (`--remove-orphans` drops the old container), `docker volume rm cabin-alloy-data`.

If this VPS previously ran Grafana, Postgres may still have a leftover `grafana` role/database — unused; drop it by hand if you want.
