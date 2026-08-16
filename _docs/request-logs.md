# Request logs (Loki + PMS)

**Status:** Implemented. Nest HTTP JSON → Loki push. Search in PMS **Request logs** (`/request-logs`, ADMIN+). Grafana is not in the stack.

**Problem:** PMS (and later `web`) show a generic error; we need the Nest line for that click: which path, which admin/guest, status, real message.

---

## Goal

Searchable **HTTP request diary** for `@cabin/api`:

```text
14:32  admin=rina  app=pms  POST /staff/reservations  409  requestId=abc-123
      dates overlap on unit A-12
```

Open PMS → Settings → Request logs → filter last 24h / that person / that path → see `200 200 409`. Same Loki for **both** FEs (`pms` and later `web`). One Nest API; each line says which app, which user, which error.

This is **not** session replay, crash grouping, or money audit (`createdByAdminId` on stays/movements stays in Postgres).

How to run Loki locally: [`deploy/loki/README.md`](../deploy/loki/README.md).

---

## Both FEs (PMS + public web)

One Nest process, one log stream. Filter in PMS — do not run two Loki stacks.

| Field | How we know | Example |
|-------|-------------|---------|
| Which FE | Header `x-cabin-app` (`pms` \| `web`) | `app=web` |
| Staff vs public API | Path prefix | `/staff/...` vs `/public/...` |
| Who | Session on that request | `admin=rina` or later `guest=…` / email |
| What failed | status + `error.code` + short message | `409 CONFLICT` overlap… |
| Which click | `requestId` | toast / error page can show it |

CS: “booking failed this morning” → `app=web` + time or `requestId` → that `500` line. Desk bug → `app=pms` + admin name. Unauthenticated browse still logs (`guest=-`) with path + `requestId`.

---

## Locked decisions

| Decision | Choice |
|----------|--------|
| Stack | **Loki** (store). Nest **push** (ship). PMS table is the UI |
| Ship logs | Nest POST `LOKI_URL/loki/api/v1/push` (label `service=api`). Tests never push. Loki down → warn, request still succeeds |
| Nest logger | `nestjs-pino` / pino-http. One line per **HTTP** request. Skip `/health`, `/public/ical/` (OTA pollers), `GET /staff/request-logs`. iCal **cron** Nest Logger stays on stdout for SSH / `docker logs` — it is not a diary row |
| Stdout | Prod: JSON (Docker `json-file`). Local host: `pino-pretty`. Stdout is for humans/SSH, not the Loki shipper |
| Query | Nest `GET /staff/request-logs` (ADMIN+) calls Loki. LogQL keeps only lines with `"req":` + `"res":` **before** the newest-500 cap. Browser never talks to Loki |
| Glue | Existing `requestId` (`x-request-id` / `meta.requestId`). Client header accepted only if length ≤ 64 and `A-Za-z0-9._-`; else mint a UUID |
| App tag | FE sends `x-cabin-app: pms` \| `web` (Origin is a fallback) |
| Audience | From path prefix: `staff` vs `public` |
| Actor | Session username when present — **inside the JSON**, not Loki labels |
| Retention | **30 days** (`compactor` + `retention_period: 720h`) |
| What to log | method, **pathname** (no query), status, duration ms, `requestId`, app, audience, actor, top-level `path`. On ≥400: `error.code` + short message. Unexpected 500: **thrown `Error.name` + first line** on the diary row (FE still gets generic `INTERNAL_ERROR`) |
| What not to log | bodies, cookies, `Authorization`, passwords, session ids, **URL query strings** (`?token=`), iCal poller GETs, the diary GET itself |
| Filters | `q` = substring of the JSON line. `path` / `requestId` / `actor` / `app` = JSON fields (`| json`), not whole-line `|=` |
| UI | PMS **Settings → Request logs** (`/request-logs`). ADMIN / SUPER_ADMIN only. Not FRONT_DESK. Not in sidebar |
| Loki bind | Local `127.0.0.1:3100` (host Nest). VPS: unpublished (`loki:3100` on `cabin-net`) |
| Postgres | Never store request logs in `cabin_pms` |

Loki labels stay **low cardinality**: `service=api` only. `requestId` / actor are JSON fields you filter in the query, not labels.

---

## Workflow

**Desk / you (Phase 1):** create stay fails → toast shows `requestId` → Settings → Request logs, last 24h or paste id → read 409 vs 500 → fix.

**CS (Phase 2 `web`):** guest reports a failed book → email / time / `requestId` → PMS `app=web` + that window → status + Nest message + which guest.

---

## VPS size (warning)

Loki is capped at **384 MB** in compose. A **2 GB** box already running Cabin + other projects can OOM. **4 GB** (or a quieter box) is still the comfortable size. Do not self-host Sentry / PostHog / GlitchTip on a 2 GB VPS.

---

## Architecture

```text
PMS / web
  │  x-cabin-app + cookie
  ▼
Nest  →  JSON line
          ├─ stdout (prod JSON / local pretty)
          └─ push → Loki  (LOKI_URL)
                                    ▲
PMS Request logs  →  Nest GET /staff/request-logs
```

`LOKI_URL` is where Loki lives — local `http://127.0.0.1:3100`, VPS compose `http://loki:3100`. Same Nest push + Nest query both places.

Compose: VPS [`docker-compose.yml`](../docker-compose.yml) always-on. Local: `pnpm logs:up` ([`docker-compose.dev.yml`](../docker-compose.dev.yml)) + host Nest.

---

## Nest / PMS

Write path: `apps/api/src/common/http/` (pino). Query path: `apps/api/src/staff/request-logs/` — not `integrations/` (no Loki SDK).

- PMS axios sends `x-cabin-app: pms`. Phase 2 web: `web` when that client exists.
- Error toasts show `requestId` when present. Unexpected 500s: PMS table shows the thrown Error; the browser envelope stays generic in production.
- `GET /staff/request-logs` — ADMIN+; numbered pages over a capped Loki window (newest 500 **HTTP** lines). Loki down → 503 `LOGS_UNAVAILABLE`. That GET is not itself autoLogged.

---

## SaaS fallback (same Nest lines)

If self-host RAM hurts, point `LOKI_URL` at a hosted Loki-compatible API. Nest push and query use that URL.

| Option | Role | Free-ish |
|--------|------|----------|
| **Grafana Cloud** | Hosted Loki — closest to self-host | Free log quota; then pay |
| **Better Stack** | Request-log search, simpler UI | Free tier; then pay |

Skip Datadog for this repo (cost / weight). Crash inbox (Sentry / GlitchTip) and public-site replay (PostHog on **`web` only**) are **out of scope** here.

---

## Don’t

- Dump every request into Postgres
- Log bodies, secrets, or URL query strings
- FRONT_DESK log browser in PMS
- Session replay on PMS (money + guest data)
- Self-host full Sentry or PostHog on a 2 GB box
- Publish Loki to the public host (VPS)
- Treat iCal cron / Docker Nest Logger noise as diary rows — push and LogQL keep HTTP lines only; do not silence the cron
- Auto-log OTA iCal pollers or `GET /staff/request-logs`

---

Root: [`AGENTS.md`](../AGENTS.md) · HTTP envelope: [`apps/api/AGENTS.md`](../apps/api/AGENTS.md) · Run Loki: [`deploy/loki/README.md`](../deploy/loki/README.md) · Vendors: [`integrations-pattern.md`](integrations-pattern.md) (this file is **not** a Nest capability port).
