# Archive storage (Garage)

**Status:** Scaffold — self-hosted object store for staff **proof / invoice** images.  
**Parallel to:** inventory media ([`media-upload-strategy.md`](media-upload-strategy.md)) — Cloudinary / Cloudflare R2 unchanged.  
**Ops:** [`deploy/garage/README.md`](../deploy/garage/README.md) (local, VPS ports, **HTTPS domain cutover**).

---

## Goal

- Store staff archive proofs (receipts, invoices) on **self-hosted Garage** (S3-compatible).
- Keep guest-facing / marketing inventory images on Cloudinary or R2.
- Same upload pattern as R2: Nest mints **presigned PUT**; browser uploads; delivery = **public URL**.
- FE compresses harder for archive (~1–1.5 MB) than gallery.

---

## Locked decisions

| Decision | Choice |
|----------|--------|
| Store | Garage `dxflrs/garage:v2.3.0` (single-node) |
| Capability | `ARCHIVE_STORAGE` — separate from `MEDIA_STORAGE` |
| Provider env | `ARCHIVE_PROVIDER=garage` |
| Access | Presigned PUT + public GET URL (like R2) |
| **Phase A (no domain)** | Host ports **3900** (S3) + **3910** (archive-proxy) — like PMS `:8080` / web `:3050` |
| **Phase B (domains + HTTPS)** | Edge on **443** by hostname; **close** interim ports — see cutover below |
| Inventory media | Untouched (`MEDIA_*` / Cloudinary / R2) |

---

## Architecture

```text
PMS (FRONT_DESK+)
  │
  │  1. GET /staff/archive/config  → { provider: garage }
  │  2. optimizeImageForUpload(file, "archive")  // edge 1280, q 0.55, max 1.5 MB
  │  3. POST /staff/archive/upload-intent
  │  4. Browser PUT → Garage S3 (presigned)
  │  5. Preview via ARCHIVE_PUBLIC_BASE_URL/{key}
```

Inventory gallery still uses `GET/POST /staff/media/*` + `uploadMediaFile`.

```text
apps/api/src/integrations/archive/   ← port + Garage adapter
apps/api/src/staff/archive/          ← HTTP
apps/pms/src/lib/api/archive.ts      ← FE driver
apps/pms/src/lib/media/optimize-image.ts  ← gallery | archive profiles
```

Object key prefix: `archive/{year}/{id}` (never `inventory/`).

---

## Env (root `.env`)

**Local:**

```text
ARCHIVE_S3_ENDPOINT=http://127.0.0.1:3900
ARCHIVE_PUBLIC_BASE_URL=http://127.0.0.1:3910
```

**VPS phase A (no domain):**

```text
ARCHIVE_S3_ENDPOINT=http://YOUR_VPS_IP:3900
ARCHIVE_PUBLIC_BASE_URL=http://YOUR_VPS_IP:3910
```

**VPS phase B (HTTPS domains):**

```text
ARCHIVE_S3_ENDPOINT=https://s3-archive.<domain>
ARCHIVE_PUBLIC_BASE_URL=https://archive.<domain>
```

Also always: `ARCHIVE_PROVIDER`, keys matching `GARAGE_DEFAULT_*`, `ARCHIVE_S3_BUCKET=cabin-archive`, `ARCHIVE_S3_FORCE_PATH_STYLE=true`.

Missing archive env → **503 on archive routes only**; media keeps working.

Nest must sign with a **browser-reachable** S3 URL — never `http://garage:3900`.

---

## Phase B cutover (summary)

Full checklist: [`deploy/garage/README.md`](../deploy/garage/README.md) § Domain HTTPS cutover.

1. DNS for `pms.` / `www.` / `archive.` / `s3-archive.`
2. Caddy or nginx on **443** → containers on `cabin-net` (`archive.` → `garage:3902` with `Host: cabin-archive`)
3. Remove compose `ports` for pms/web/garage/archive-proxy; firewall **80/443** only
4. `.env`: `COOKIE_SECURE=true`, HTTPS `CORS_ORIGINS` / `PUBLIC_PMS_BASE_URL` / `ARCHIVE_*`
5. Re-apply Garage CORS for `https://pms.<domain>`; restart api

Same pattern for FE and Garage: interim IP+port → later hostname+TLS edge.

---

## API

| Method | Path | Role | Notes |
|--------|------|------|--------|
| `GET` | `/staff/archive/config` | FRONT_DESK+ | `{ provider }` |
| `POST` | `/staff/archive/upload-intent` | FRONT_DESK+ | Final mime/size after FE compress |
| — | No Nest multipart | — | Do not proxy file bytes |

Bounds: `ARCHIVE_*` in `@cabin/api-contract` (2 MB ceiling, jpeg/png/webp, edge 1280).

---

## Local commands

```bash
pnpm archive:up      # garage + archive-proxy
pnpm archive:down
pnpm archive:logs
```

After first start:

```bash
# Local
pnpm archive:bootstrap

# VPS (no pnpm)
./deploy/garage/bootstrap-vps.sh
```

Set `ARCHIVE_CORS_ORIGINS` in `.env` first. See [`deploy/garage/README.md`](../deploy/garage/README.md).

PMS Settings → **Archive upload smoke test (temp)** exercises the path (remove when real proof UI ships).

---

## Don’t

- Point `MEDIA_PROVIDER` at Garage for inventory
- Share object key prefixes with inventory (`inventory/` vs `archive/`)
- Proxy archive bytes through Nest or under PMS `/api/`
- Treat archive public URLs as guest-site marketing assets
- Leave `:3900`/`:3910` (or `:8080`/`:3050`) open after domain HTTPS cutover
