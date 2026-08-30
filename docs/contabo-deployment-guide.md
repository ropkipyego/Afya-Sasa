# AfyaSasa — Contabo VPS Deployment Guide

> **Detailed PDF (28 pages):** [`contabo-deployment-guide.pdf`](./contabo-deployment-guide.pdf) · Source: [`contabo-deployment-guide-detailed.md`](./contabo-deployment-guide-detailed.md)

**Hospital:** Jalaram Hospital (single-tenant pilot)  
**Stack:** Docker Compose — PostgreSQL, Redis, MinIO, NestJS, React, Nginx  
**Audience:** IT admin deploying a supervised clinical pilot (not anonymous public SaaS)

---

## 1. What you are deploying

AfyaSasa runs as **six Docker containers**:

| Service | Role | Exposed in production |
|---------|------|------------------------|
| **nginx** | Public entry (UI + API proxy) | Port **80** (and **443** with TLS) |
| **frontend** | React SPA | Internal only |
| **backend** | NestJS API | Internal only |
| **postgres** | Clinical database | Internal only |
| **redis** | Queue/cache | Internal only |
| **minio** | Clinical file storage | Internal only |

Production uses `docker-compose.prod.yml` so **only Nginx** is reachable from the internet. Database and MinIO must never be published publicly.

---

## 2. Recommended Contabo VPS

| Spec | Minimum | Recommended (pilot) |
|------|---------|---------------------|
| RAM | 4 GB | **8 GB** |
| CPU | 2 vCPU | 4 vCPU |
| Disk | 80 GB SSD | **160 GB SSD** |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Location | EU (Germany) OK for testing | **Consider latency to Kenya** — Truehost/local VPS may be faster for daily use |

**Contabo is fine for pilot/staging.** For production with many concurrent users in Kenya, measure latency after deploy; a Kenya-region VPS often gives better response times.

---

## 3. Domain and DNS

1. Register or use a subdomain, e.g. `emr.jalaram.co.ke` or `afya.jalaramhospital.com`.
2. Create an **A record** pointing to your Contabo VPS public IP.
3. Optional: `www` CNAME to the same host.

Wait for DNS propagation (5–60 minutes), then verify:

```bash
dig +short emr.jalaram.co.ke
```

---

## 4. Initial server setup

SSH into the VPS as root, then create a deploy user:

```bash
adduser afyasasa
usermod -aG sudo afyasasa
rsync --archive --chown=afyasasa:afyasasa ~/.ssh /home/afyasasa
```

Log in as `afyasasa` for the rest.

### 4.1 System updates and firewall

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw fail2ban
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 4.2 Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker compose version
```

---

## 5. Clone the application

```bash
sudo mkdir -p /opt/afyasasa
sudo chown $USER:$USER /opt/afyasasa
cd /opt/afyasasa
git clone <YOUR_REPO_URL> .
# Or upload a release tarball and extract here
```

---

## 6. Production environment file

```bash
cp .env.example .env
nano .env
```

**Required production values:**

```env
NODE_ENV=production
PORT=3000

# Public URL (used in emails, CORS, links)
FRONTEND_ORIGIN=https://emr.jalaram.co.ke
APP_PUBLIC_URL=https://emr.jalaram.co.ke

# Database — generate strong passwords
POSTGRES_DB=afyasasa
POSTGRES_USER=afyasasa
POSTGRES_PASSWORD=<long-random-string>
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Jalaram single-hospital
DEFAULT_TENANT_SCHEMA=demo
DEFAULT_TENANT_CODE=jalaram
HOSPITAL_NUMBER_PREFIX=JH
TYPEORM_MIGRATIONS_RUN=true

# Redis (internal hostname in compose)
REDIS_HOST=redis
REDIS_PORT=6379

# JWT — generate with: openssl rand -base64 48
JWT_ACCESS_SECRET=<long-random>
JWT_REFRESH_SECRET=<long-random>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# MinIO / S3 (internal)
MINIO_ROOT_USER=afyasasa
MINIO_ROOT_PASSWORD=<long-random>
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY_ID=afyasasa
S3_SECRET_ACCESS_KEY=<same-as-minio-or-separate>
S3_BUCKET=afyasasa-clinical-files
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true

# SMS — keep stub until Celcom keys are approved
SMS_PROVIDER=stub
SMS_SENDER_NAME=JALARAM

# Frontend build args (also set here for compose)
VITE_DEFAULT_TENANT=jalaram
VITE_HIDE_TENANT_SELECTOR=true
VITE_API_BASE_URL=/api/v1
```

**Never commit `.env` to git.**

Generate secrets:

```bash
openssl rand -base64 48   # repeat for each secret
```

---

## 7. Build and start (production compose)

From `/opt/afyasasa`:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Watch logs until migrations finish:

```bash
docker compose logs -f backend
# Wait for: "Nest application successfully started"
```

Verify health:

```bash
curl -fsS http://127.0.0.1/api/v1/health
# {"status":"ok","service":"afyasasa-backend"}
```

Open in browser (HTTP only until TLS): `http://YOUR_VPS_IP/` or `http://emr.jalaram.co.ke/`

---

## 8. HTTPS with Let's Encrypt (recommended)

Use **host Nginx** as TLS terminator in front of Docker Nginx on port 80.

### 8.1 Install host Nginx + Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 8.2 Host Nginx site config

```bash
sudo nano /etc/nginx/sites-available/afyasasa
```

```nginx
server {
    listen 80;
    server_name emr.jalaram.co.ke;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Note:** Docker prod compose binds host port 80. Either:
- **Option A:** Change `docker-compose.prod.yml` nginx to `"127.0.0.1:8080:80"` and proxy host nginx to `127.0.0.1:8080`, or  
- **Option B:** Stop host nginx on 80 and use **Caddy** or **certbot standalone** with adjusted ports.

**Recommended Option A** — edit prod override:

```yaml
nginx:
  ports:
    - "127.0.0.1:8080:80"
```

Then host nginx proxies to `http://127.0.0.1:8080`.

```bash
sudo ln -s /etc/nginx/sites-available/afyasasa /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d emr.jalaram.co.ke
```

Certbot will add HTTPS and auto-renewal.

Update `.env`:

```env
FRONTEND_ORIGIN=https://emr.jalaram.co.ke
APP_PUBLIC_URL=https://emr.jalaram.co.ke
```

Rebuild frontend if origin changed:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build frontend nginx
```

---

## 9. First login and hardening

| Item | Action |
|------|--------|
| Admin login | `it@jalaram.co.ke` / initial password from seed |
| Force password change | Complete on first login |
| Change all staff passwords | Account Center |
| Hide hospital code | Already set via `VITE_HIDE_TENANT_SELECTOR=true` |
| Swagger | Restrict in production — do not expose `/docs` publicly without IP allowlist |
| MinIO console | **Not published** in prod compose — good |

Run smoke test from the server:

```bash
API=http://127.0.0.1/api/v1 TENANT=jalaram ./ops/opd-workflow-test.sh
```

---

## 10. Backups (mandatory before real patients)

### 10.1 PostgreSQL daily backup

```bash
sudo mkdir -p /opt/afyasasa/backups
sudo chown $USER:$USER /opt/afyasasa/backups
```

Create `/opt/afyasasa/scripts/backup-db.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
docker compose -f /opt/afyasasa/docker-compose.yml exec -T postgres \
  pg_dump -U afyasasa afyasasa | gzip > "/opt/afyasasa/backups/afyasasa-${STAMP}.sql.gz"
find /opt/afyasasa/backups -name '*.sql.gz' -mtime +14 -delete
```

```bash
chmod +x /opt/afyasasa/scripts/backup-db.sh
crontab -e
# Add: 0 2 * * * /opt/afyasasa/scripts/backup-db.sh
```

### 10.2 Restore test (do once)

```bash
gunzip -c backups/afyasasa-YYYYMMDD.sql.gz | \
  docker compose exec -T postgres psql -U afyasasa -d afyasasa
```

### 10.3 MinIO data

Back up Docker volume `afyasasa_minio-data` periodically, or sync bucket to external storage using `mc mirror`.

---

## 11. Updates and redeploy

```bash
cd /opt/afyasasa
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose logs -f backend --tail 50
```

Migrations run automatically when `TYPEORM_MIGRATIONS_RUN=true`.

---

## 12. Monitoring checklist

| Check | Command / URL |
|-------|----------------|
| All containers up | `docker compose ps` |
| API health | `curl -fsS https://emr.jalaram.co.ke/api/v1/health` |
| Disk space | `df -h` |
| Memory | `free -h` |
| Logs errors | `docker compose logs backend --since 1h \| grep -i error` |
| Backup exists | `ls -lh /opt/afyasasa/backups/` |

---

## 13. Celcom SMS (when keys arrive)

In `.env`:

```env
SMS_PROVIDER=celcom_africa
CELCOM_API_KEY=<from Celcom>
CELCOM_PARTNER_ID=<from Celcom>
CELCOM_SHORTCODE=JALARAMHNKR
```

Restart backend:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d backend
```

Test from Admin → Notifications before bulk sends.

---

## 14. Security reminders

- Do **not** expose ports 5432, 6379, 9000, 9001, or 3000 to the internet.
- Rotate JWT and database passwords from `.env.example` defaults.
- Use strong passwords for all staff accounts.
- Enable **fail2ban** (installed above).
- Restrict SSH to key-based auth; disable password login when stable.
- Pilot only with **supervised** clinical use until UAT sign-off (`docs/go-live-checklist.md`).
- Do not put real patient data on the server until backups are verified.

---

## 15. Troubleshooting

| Problem | Fix |
|---------|-----|
| `502 Bad Gateway` | `docker compose ps` — ensure backend is healthy |
| Migrations fail | `docker compose logs backend`; check Postgres credentials match `.env` |
| Login fails | Verify `X-Tenant: jalaram`; reset admin: `npm run db:reset-admin` inside backend container |
| Blank frontend | Rebuild: `docker compose ... up -d --build frontend` |
| CORS errors | `FRONTEND_ORIGIN` must match exact browser URL (https) |
| Slow from Kenya | Measure latency; consider Kenya-hosted VPS for production |

---

## 16. Related documents

- Core workflow test plan: `docs/core-workflow-test-plan.md`
- Go-live checklist: `docs/go-live-checklist.md`
- Core workflow gaps: `docs/core-workflow-gap-matrix.md`
- Local testing: `docs/local-testing-guide.md`

---

## Quick reference

```bash
# Start
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Stop
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# Logs
docker compose logs -f backend

# Smoke
API=http://127.0.0.1/api/v1 TENANT=jalaram ./ops/opd-workflow-test.sh
```

**Pilot URL:** `https://emr.jalaram.co.ke` (replace with your domain)  
**Admin:** `it@jalaram.co.ke`  
**Tenant code:** hidden — defaults to `jalaram`
