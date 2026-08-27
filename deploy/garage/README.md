# Garage — archive object storage

Self-hosted S3-compatible store for **staff archive proofs** (invoices, receipts). Inventory gallery/cover stays on Cloudinary / Cloudflare R2 — see [`_docs/archive-storage.md`](../../_docs/archive-storage.md).

Image: `dxflrs/garage:v2.3.0` (single-node).

---

## Exposure phases (locked)

| Phase | When | How browsers reach Garage |
|-------|------|---------------------------|
| **A — No domain** (now) | Local laptop + VPS by IP | Publish host ports **3900** (S3 PUT) + **3910** (public GET via archive-proxy) — same idea as PMS `:8080` / web `:3050` |
| **B — Domains + HTTPS** (later) | Real DNS + TLS | Edge reverse proxy on **443** by hostname; **remove** public `8080`/`3050`/`3900`/`3910` |

Do **not** put Garage under PMS `/api/` (breaks presigned URL Host/path). Nest never proxies file bytes.

---

## Local (Nest + Vite on host)

```bash
pnpm archive:up
```

| Host | Role |
|------|------|
| `127.0.0.1:3900` | S3 API (browser presigned PUT) |
| `127.0.0.1:3910` | Public GET via archive-proxy → Garage web |
| `127.0.0.1:3903` | Admin API / CLI (localhost only — not on VPS public) |

```text
ARCHIVE_S3_ENDPOINT=http://127.0.0.1:3900
ARCHIVE_PUBLIC_BASE_URL=http://127.0.0.1:3910
ARCHIVE_S3_ACCESS_KEY_ID=<same as GARAGE_DEFAULT_ACCESS_KEY>
ARCHIVE_S3_SECRET_ACCESS_KEY=<same as GARAGE_DEFAULT_SECRET_KEY>
ARCHIVE_S3_BUCKET=cabin-archive
ARCHIVE_S3_FORCE_PATH_STYLE=true
```

---

## VPS phase A — no domain (open ports)

Same pattern as FE: compose publishes ports; firewall allows them; Nest env uses **VPS IP**.

| Host port | Service | Role |
|-----------|---------|------|
| **8080** | pms | Staff UI (incl. Request logs) |
| **3050** | web | Public site |
| **3900** | garage | S3 API (presigned PUT) |
| **3910** | archive-proxy | Public GET (`Host: cabin-archive` → `garage:3902`) |

**VPS `.env` (replace IP):**

```text
ARCHIVE_S3_ENDPOINT=http://YOUR_VPS_IP:3900
ARCHIVE_PUBLIC_BASE_URL=http://YOUR_VPS_IP:3910
```

CORS AllowedOrigins must include `http://YOUR_VPS_IP:8080` (and local `http://localhost:5173` if needed).

Do **not** set `ARCHIVE_S3_ENDPOINT=http://garage:3900` — browsers cannot resolve Docker DNS.

Admin API (`3903`) stays **unpublished** on VPS.

### Bootstrap (website + CORS)

**Local** (pnpm + api `node_modules`):

```bash
pnpm archive:bootstrap
```

**VPS** (Docker only — no pnpm):

```bash
# .env must include ARCHIVE_CORS_ORIGINS=http://YOUR_VPS_IP:8080
chmod +x deploy/garage/bootstrap-vps.sh
./deploy/garage/bootstrap-vps.sh
```

Runs CORS via `docker exec cabin-api` → `garage:3900` (same compose network). Works with GHCR tags (`ghcr.io/<owner>/cabin-api:…`); does **not** pull `node:` from Docker Hub. Requires `cabin-api` already up.

| Environment | `ARCHIVE_CORS_ORIGINS` |
|-------------|------------------------|
| Local PMS | `http://localhost:5173,http://127.0.0.1:5173` |
| VPS by IP | `http://YOUR_VPS_IP:8080` |
| HTTPS domain | `https://pms.yourdomain.com` |

Scripts: [`bootstrap.mjs`](bootstrap.mjs) · [`bootstrap-vps.sh`](bootstrap-vps.sh) — website via `docker exec`, CORS via Node AWS SDK (**one origin per rule**), OPTIONS probe.

---

## Phase B — Domain HTTPS cutover (checklist)

When DNS + TLS exist, **stop publishing app ports** and terminate TLS at an edge (Caddy, nginx, or Cloudflare → origin).

### 1. DNS

| Hostname | Points at |
|----------|-----------|
| `pms.<domain>` | VPS |
| `www.<domain>` (or apex) | VPS |
| `archive.<domain>` | VPS (public GET) |
| `s3-archive.<domain>` | VPS (S3 PUT) |

### 2. Edge reverse proxy (Caddy or nginx)

Listen **80/443** only. Route by `Host`:

| Public host | Upstream | Extra |
|-------------|----------|--------|
| `pms.<domain>` | `pms:80` | — |
| `www.<domain>` | `web:80` | — |
| `archive.<domain>` | `garage:3902` | Set `Host: cabin-archive` (same as [`nginx-archive.conf`](nginx-archive.conf)) |
| `s3-archive.<domain>` | `garage:3900` | Preserve Host for path-style S3; large `client_max_body_size` |

Enable HTTPS (Caddy auto Let’s Encrypt, or certbot + nginx).

Example Caddy sketch:

```caddyfile
pms.example.com {
  reverse_proxy pms:80
}
www.example.com {
  reverse_proxy web:80
}
archive.example.com {
  reverse_proxy garage:3902 {
    header_up Host cabin-archive
  }
}
s3-archive.example.com {
  reverse_proxy garage:3900
}
```

(Edge must share Docker network `cabin-net`, or proxy to `127.0.0.1` if you temporarily keep localhost binds.)

### 3. Compose: close interim ports

In [`docker-compose.yml`](../../docker-compose.yml):

- Remove `ports:` from `pms`, `web`, `garage`, `archive-proxy` (or stop publishing `archive-proxy` entirely if edge talks to `garage:3902` directly).
- Keep `expose` / internal network only.
- Firewall: allow **80/443**; deny **8080, 3050, 3900, 3910**.

### 4. Env cutover (root `.env` on VPS)

```text
COOKIE_SECURE=true
CORS_ORIGINS=https://pms.<domain>,https://www.<domain>
PUBLIC_PMS_BASE_URL=https://pms.<domain>

ARCHIVE_S3_ENDPOINT=https://s3-archive.<domain>
ARCHIVE_PUBLIC_BASE_URL=https://archive.<domain>
```

Re-apply bucket CORS with HTTPS PMS origin (`https://pms.<domain>`). Restart `api` after env change.

### 5. Verify

- PMS login over HTTPS (secure cookie).
- PMS Request logs (ADMIN+) — Loki stays unpublished.
- Settings archive smoke: PUT to `s3-archive.` + preview from `archive.`.
- Inventory media still on Cloudinary/R2 (`MEDIA_*` unchanged).

---

## Secrets

Rotate `GARAGE_RPC_SECRET`, `GARAGE_ADMIN_TOKEN`, `GARAGE_METRICS_TOKEN`, `GARAGE_DEFAULT_*`, and matching `ARCHIVE_S3_*` in root `.env` before prod (compose passes them as `GARAGE_*` env — not in [`garage.toml`](garage.toml)).
