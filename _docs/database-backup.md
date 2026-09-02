# Database backup (PostgreSQL)

**Status:** Policy + runbook. Automation (cron + off-site upload) is ops setup on the VPS — not in the app repo yet.

**Problem:** Reservations, guests, and money live only in Postgres. If the VPS disk dies or a bad migration runs, we need a recent copy we can restore on the same or a new server.

---

## Goal

- **One daily logical backup** of `cabin_pms` (all business data).
- **At least one copy off the VPS** (different provider / account).
- **Restore tested once** when backup is first configured, then after major schema changes.

This is **disaster recovery** and **VPS migration** — not “undo the last edit.” A dump is a snapshot at dump time; restore rewinds the whole DB to that moment.

---

## What we back up

| Asset | Backup? | Why |
|-------|---------|-----|
| **PostgreSQL** (`cabin_pms`) | **Yes** | Reservations, guests, money (`PaymentMovement`), inventory, admins, iCal feeds, sessions |
| Root **`.env`** | **Yes** (encrypted off-site) | Secrets — not in Git; needed to run API on a new VPS |
| **Garage** archive (invoice / proof images) | **No** | Ops convenience only; not required for business continuity |
| **Loki** request logs | **No** | 30-day diary; see [`request-logs.md`](request-logs.md) |
| **Docker images** | **No** | Rebuild / pull from GHCR (`release` deploy) |
| **App source** | **No** | GitHub |
| **Inventory gallery** (Cloudinary / R2) | **No** | Vendor-hosted; re-upload if needed |

Postgres stores **URLs** to archive proofs in JSON (`proofImages`) — not the image bytes. Losing Garage does not corrupt the DB; links may 404.

---

## Locked decisions

| Decision | Choice |
|----------|--------|
| Tool | **`pg_dump`** custom format (`-Fc`), compressed |
| Schedule | **Daily** (e.g. 02:15 server local time) |
| Local retention on VPS | **14** daily files, then delete older |
| Off-site retention | **14** daily + optional monthly archives (3–6 months) |
| Off-site storage | **S3-compatible object storage** (Backblaze B2 or Cloudflare R2) — primary |
| Google Drive | Optional **second** copy via `rclone` / `restic` — not the only copy |
| Postgres version on restore | **16** (`postgres:16-alpine` in `docker-compose.yml`) |
| Encryption | Encrypt dump **before** upload (GPG or provider-side + bucket private) |
| Alerts | Email or webhook if backup job fails or no success in **36 h** |

Do **not** rely on VPS provider snapshots alone — they are not a substitute for a logical DB dump.

---

## Size (30 GB VPS)

Business data is small (text + numbers). Proof images are **not** in Postgres.

| Scenario | DB on disk (approx.) | One `-Fc` dump (approx.) |
|----------|----------------------|---------------------------|
| Fresh seed / early prod | 50–150 MB | **20–50 MB** |
| ~5 years heavy use | 200 MB–1 GB | **80–400 MB** |
| 14 daily dumps (today) | — | **~300–700 MB** total local |

On a **30 GB** disk, Postgres is unlikely to be the bottleneck — Docker images and Garage grow faster. Keep **≥ 5 GB** free on `/`.

Check live size on the VPS:

```bash
docker compose exec postgres psql -U postgres -d cabin_pms -c \
  "SELECT pg_size_pretty(pg_database_size('cabin_pms'));"
df -h /
```

---

## Where to store backups

```text
VPS (fast restore)          Off-site (survives VPS loss)
/root/backups/*.dump   →    B2 or R2 bucket (e.g. cabin-pms-backups/postgres/)
```

| Destination | Role | Notes |
|-------------|------|-------|
| **`/root/backups/`** (root) or **`~/backups/`** (deploy SSH user) | Last 14 days | Quick restore; same disk as prod — not enough alone |
| **Backblaze B2** | Primary off-site | ~$0.006/GB/mo; S3 API; `rclone` / `aws` CLI |
| **Cloudflare R2** | Primary off-site | ~$0.015/GB/mo; zero egress; good if already on Cloudflare |
| **Google Drive** | Optional extra | Fine for solo ops; API limits; not sole production copy |

Cost at current scale: **well under $1/month** for Postgres dumps only.

---

## Backup command

From repo root on the VPS (`~/property-management-system`):

```bash
mkdir -p /root/backups
STAMP=$(date +%F)
docker compose exec -T postgres pg_dump \
  -U "${POSTGRES_USER:-postgres}" \
  -Fc \
  "${POSTGRES_DB:-cabin_pms}" \
  > "/root/backups/cabin-${STAMP}.dump"
```

Prune local files older than 14 days:

```bash
find /root/backups -name 'cabin-*.dump' -mtime +14 -delete
```

**Cron example** (`crontab -e` as root):

```cron
# root crontab — adjust repo path if needed
15 2 * * * cd /root/property-management-system && bash deploy/backup/backup-db.sh >> /var/log/cabin-backup.log 2>&1

# deploy SSH user (e.g. didik) — backups go to ~/backups/
15 2 * * * cd /home/didik/property-management-system && bash deploy/backup/backup-db.sh >> /home/didik/cabin-backup.log 2>&1
```

### VPS compatibility (Ubuntu, Alibaba Linux, …)

Scripts require **bash** (not plain `sh`) and **Docker Engine** with either:

- **`docker compose`** v2 plugin (preferred), or
- legacy **`docker-compose`** v1 binary (fallback for `pg_dump` / `migrate` exec)

Deploy runs [`deploy/lib/compose.sh`](../deploy/lib/compose.sh) `compose_bootstrap_if_missing` to install the v2 plugin when only broken apt `docker-compose` v1 is present (common on Ubuntu / Alibaba Linux images).

| Concern | Notes |
|---------|--------|
| Host OS | Ubuntu, Debian, Alibaba Linux, CentOS/RHEL — backup runs **inside** the `postgres:16-alpine` container; host does not need `pg_dump` installed |
| Shell | Use `bash deploy/backup/backup-db.sh` in cron, or invoke the script directly (shebang uses `env bash`) |
| Line endings | Keep `.sh` files **LF** (not CRLF) or shebang breaks on Linux |
| Compose project | Scripts read optional `COMPOSE_FILE_ARGS` (same `-f` flags as deploy) |
| Cron user | **root** → `/root/backups`; deploy SSH user (e.g. `didik`) → `~/backups`. Override with `BACKUP_DIR` in `.env` or cron |

### Pre-migrate backup (deploy)

VPS deploy runs `bash deploy/vps-migrate-deploy.sh` instead of calling `prisma migrate deploy` directly:

1. `prisma migrate status` — if the DB is already up to date, **no extra backup**.
2. If migrations are **pending**, run `backup-db.sh` with tag `pre-migrate` → `cabin-pre-migrate-YYYY-MM-DD.dump`.
3. `prisma migrate deploy`.

Code-only deploys (no pending migrations) skip step 2. Failed migrations abort deploy until fixed manually.

Upload off-site (after `rclone config` for B2/R2):

```bash
rclone copy /root/backups/cabin-$(date +%F).dump remote:cabin-pms-backups/postgres/
```

---

## Restore (same VPS or new VPS)

Restore replaces **all** data in `cabin_pms` with the dump contents. Work after the dump timestamp is lost.

**1.** Postgres container running (`docker compose up -d postgres`).

**2.** Restore (drops/recreates objects in the dump — use on empty or disposable DB):

```bash
docker compose exec -T postgres pg_restore \
  -U "${POSTGRES_USER:-postgres}" \
  -d "${POSTGRES_DB:-cabin_pms}" \
  --clean --if-exists \
  < /root/backups/cabin-2026-08-28.dump
```

**3.** Start stack: `docker compose up -d`.

**4.** Smoke test: login, open a reservation, check paid total.

### Migrate to another VPS

1. `pg_dump` on old VPS → copy `.dump` + root `.env` to new host.
2. New VPS: clone repo, `docker compose up -d postgres`, wait healthy.
3. `pg_restore` as above (schema is inside the dump — **do not** run `prisma migrate` on top unless restoring to an empty DB without schema).
4. `docker compose up -d` (pull GHCR images per normal deploy).
5. Point DNS / ports to new host.

Stay on **Postgres 16** on both sides when possible.

---

## What “1:1” means

- **Yes:** Same rows — properties, units, reservations, movements, admins. App behaves as on dump day.
- **Not:** Byte-identical files on disk inside Postgres.
- **Sessions:** Staff may need to log in again after restore.
- **Garage:** Not restored; `proofImages` URLs may break — accepted.

---

## Restore drill (required once)

1. Take a dump from prod.
2. On local dev (`pnpm db:up`) or a staging VPS, restore into a **throwaway** database name first if nervous.
3. Confirm `SELECT count(*) FROM "Reservation";` and one known stay’s `paidAmountIdr`.
4. Note how long restore took (your **RTO** baseline).

Repeat after large Prisma migrations.

---

## Out of scope (for now)

- Point-in-time recovery (WAL / pgBackRest) — only needed if sub-hour RPO is required.
- Garage / Loki backup jobs.

---

## Related

- Stack: [`docker-compose.yml`](../docker-compose.yml) · Postgres service `postgres`, volume `cabin-postgres-data`
- Deploy: root [`AGENTS.md`](../AGENTS.md) · GHCR pull on `release`
- Money / reservations domain: [`reservations-design.md`](reservations-design.md)
- Archive (not backed up): [`archive-storage.md`](archive-storage.md)
