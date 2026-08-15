# Request logs (Grafana + Loki)

**Status:** Locked direction — not implemented.  
**Problem:** PMS (and later `web`) show a generic error; we need the Nest line for that click: which path, which admin/guest, status, real message.  
**Today:** `x-request-id` on every response; 500s print to Docker `json-file` (10m × 3) then rotate. No search by path / admin / time / status.

---

## Goal

Searchable **HTTP request diary** for `@cabin/api`:

```text
14:32  admin=rina  app=pms  POST /staff/reservations  409  requestId=abc-123
      dates overlap on unit A-12
```

Open Grafana → filter last hour / that person / that path → see `200 200 409`. Same Loki for **both** FEs (`pms` and later `web`). One Nest API; each line says which app, which user, which error.

This is **not** session replay, crash grouping, or money audit (`createdByAdminId` on stays/movements stays in Postgres).

---

## Both FEs (PMS + public web)

One Nest process, one log stream. Filter in Grafana — do not run two Loki stacks.

| Field | How we know | Example |
|-------|-------------|---------|
| Which FE | Header `x-cabin-app` (`pms` \| `web`) | `app=web` |
| Staff vs public API | Path prefix | `/staff/...` vs `/public/...` |
| Who | Session on that request | `admin=rina` or later `guest=…` / email |
| What failed | status + `error.code` + short message | `409 CONFLICT` overlap… |
| Which click | `requestId` | toast / error page can show it |

```text
14:32  app=pms  admin=rina   POST /staff/reservations           409  overlap on unit A-12
09:10  app=web  guest=budi   POST /public/reservations         500  INTERNAL_ERROR  requestId=…
09:11  app=web  guest=budi   GET  /public/units/u1/availability 200
```

CS: “booking failed this morning” → `app=web` + time or `requestId` → that `500` line. Desk bug → `app=pms` + admin name. Unauthenticated browse still logs (`guest=-`) with path + `requestId`.

---

## Locked decisions

| Decision | Choice |
|----------|--------|
| Stack | **Grafana** (UI) + **Loki** (store) |
| Ship logs | Nest stdout JSON → Docker logs → **Grafana Alloy** → Loki. Nest does **not** call Loki. |
| Nest logger | Structured JSON (`nestjs-pino` or equivalent). One line per request. |
| Glue | Existing `requestId` (`x-request-id` / `meta.requestId`) on every line |
| App tag | FE sends `x-cabin-app: pms` \| `web` (Origin is a fallback) |
| Audience | From path prefix: `staff` vs `public` |
| Actor | Session `adminId` / username when present; later public `guestId` — **inside the JSON**, not Loki labels |
| Retention | **30 days**, then delete (compactor on). Default Loki = keep forever — do not ship without this |
| What to log | method, path, status, duration ms, `requestId`, app, audience, actor, error `code` + short message on ≥400 |
| What not to log | bodies, cookies, `Authorization`, passwords, session ids |
| UI | Grafana **Explore** only. No PMS “Log” menu. No Nest route that clones Grafana |
| Who looks | Operators / SUPER_ADMIN (Grafana login). Not FRONT_DESK |
| Grafana bind | Localhost or later HTTPS hostname + Grafana auth. **Do not** publish an open host port like PMS `:8080` |
| Postgres | Never store request logs in `cabin_pms` |

Loki labels stay **low cardinality**: `service=api`, `env`, maybe `audience`. `requestId` / `adminId` are JSON fields you filter in the query, not labels (labels-per-request blows the index).

---

## Workflow

**Desk / you (Phase 1):** create stay fails → toast may show `requestId` → Grafana last 15 min, `POST /staff/reservations` or paste id → read 409 vs 500 → fix.

**CS (Phase 2 `web`):** guest reports a failed book → email / time / `requestId` → Grafana `app=web` (not `pms`) + that window → status + Nest message + which guest. Optional later: a SUPER_ADMIN **requestId lookup** in PMS that queries Loki — not a log browser.

---

## VPS size (gate)

Current prod box is **2 vCPU / 2 GB**, already running Cabin (Postgres + Nest + PMS + web + Garage) **and** other projects.

Grafana + Loki + Alloy ≈ **400–550 MB**. That does **not** fit beside this stack on 2 GB (OOM or swap).

| When | What |
|------|------|
| Stay on 2 GB | Keep Docker logs. Nest JSON lines still worth doing (searchable later). Or send the same lines to a **SaaS** (below) |
| Self-host Loki here | **4 GB RAM** (or a second small box) first |
| Do not | Self-host Sentry / PostHog / GlitchTip on this 2 GB VPS |

---

## Architecture

```text
PMS / web
  │  x-cabin-app + cookie
  ▼
Nest  →  JSON line (stdout)  →  Docker json-file
                                    │
                               Grafana Alloy
                                    ▼
                                  Loki  ←  Grafana Explore (you / CS)
```

```text
14:31  GET  /staff/properties/.../availability   200
14:32  POST /staff/reservations                  409   overlap …
```

---

## Nest wiring (when implementing)

Infra, not `apps/api/src/integrations/` — no Loki SDK in domain/controllers. Same pattern as today’s `Logger`: emit; compose ships.

1. **`nestjs-pino`** (or Pino) as Nest logger — JSON in production, pretty optional in local.
2. **HTTP log** after the response (interceptor or `pino-http`): fields in the table above. Reuse `getRequestId()`.
3. **`HttpExceptionFilter`:** include `requestId`, path, status on the 500 line (stack stays server-side).
4. **PMS axios** (`apps/pms/src/lib/api/client.ts`): default header `x-cabin-app: pms`. Phase 2 web: `web`.
5. Keep showing `requestId` on error toasts (client already reads `meta.requestId`).

Do not add `GET /staff/logs`. Loki stays on the Docker network; Grafana is the query UI.

---

## Compose + files to touch

| File | Change |
|------|--------|
| `docker-compose.yml` | Services `loki`, `grafana`, `alloy`. Memory limits. Loki **not** published to the public host. Grafana `127.0.0.1:<port>` (Nest already uses container `:3000`). Volume for Loki chunks + Grafana data |
| Loki config (e.g. `deploy/loki/`) | Filesystem or later object store; **compactor `retention_period: 720h` (30d)** |
| Alloy config | Tail **`cabin-api`** container logs only (not Postgres/Garage noise unless we want it later) |
| `docker-compose.dev.yml` | Optional local Loki+Grafana; not required for Nest-on-host `pnpm --filter @cabin/api dev` (stdout is enough) |
| `.env.example` | Grafana admin password; no Loki secrets if Alloy is internal-only |
| Root `AGENTS.md` | Port / “ops UI is Grafana, not PMS” when compose is live |
| `apps/api/AGENTS.md` | One line: JSON request logs; search in Grafana |
| `deploy/` README | How to open Grafana (SSH tunnel vs later hostname) |

Existing `x-logging` json-file rotation can stay — Alloy reads it; rotation still caps disk if Loki is down.

---

## SaaS fallback (same Nest lines)

If the VPS stays at 2 GB, point Alloy (or a Pino transport) at a hosted Loki-compatible API. Nest code does not change.

| Option | Role | Free-ish |
|--------|------|----------|
| **Grafana Cloud** | Hosted Loki + Grafana — closest to self-host | Free log quota; then pay |
| **Better Stack** | Request-log search, simpler UI | Free tier; then pay |

Skip Datadog for this repo (cost / weight). Crash inbox (Sentry / GlitchTip) and public-site replay (PostHog on **`web` only**) are **out of scope** here.

---

## Don’t

- Dump every request into Postgres
- Log bodies or secrets
- FRONT_DESK log browser in PMS
- Session replay on PMS (money + guest data)
- Self-host full Sentry or PostHog on the 2 GB box
- Treat iCal/Docker noise as a substitute for Nest JSON request lines

---

Root: [`AGENTS.md`](../AGENTS.md) · HTTP envelope: [`apps/api/AGENTS.md`](../apps/api/AGENTS.md) · Vendors: [`integrations-pattern.md`](integrations-pattern.md) (this file is **not** a Nest capability port).
