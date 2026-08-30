# AfyaSasa — Contabo VPS Deployment Guide (Detailed)

**Document version:** 1.1  
**Date:** 28 August 2026  
**Hospital:** Jalaram Hospital (single-tenant supervised pilot)  
**Stack:** Docker Compose — PostgreSQL 16, Redis 7, MinIO, NestJS backend, React frontend, Nginx reverse proxy  
**Audience:** IT administrators and DevOps engineers deploying AfyaSasa for supervised clinical use

---

## Table of contents

1. Purpose and scope  
2. Architecture overview  
3. Prerequisites checklist  
4. Contabo VPS selection and ordering  
5. Domain name and DNS  
6. Initial server setup  
7. Install Docker  
8. Deploy application code  
9. Production environment configuration  
10. Build and start the stack  
11. Verify migrations and tenant  
12. HTTPS with Let's Encrypt  
13. First login and account hardening  
14. Post-deploy testing  
15. Backups and disaster recovery  
16. Updates, redeploy, and rollback  
17. Monitoring and maintenance  
18. Celcom SMS integration  
19. Security hardening  
20. Troubleshooting reference  
21. Post-deploy sign-off checklist  
22. Quick command reference  
23. Related documents  

---

## 1. Purpose and scope

This guide walks through deploying AfyaSasa on a **Contabo VPS** (or any Ubuntu 22.04 LTS VPS) for **Jalaram Hospital** as a **supervised clinical pilot**.

### What this guide covers

- Full server provisioning from empty VPS to HTTPS-accessible EMR  
- Production Docker Compose configuration  
- TLS termination with host Nginx and Certbot  
- Database and file storage backups  
- Post-deploy API verification  
- Security baseline for internet-facing pilot  

### What this guide does not cover

- Full clinical UAT (see `docs/go-live-checklist.md`)  
- SHA/HIE national integration (future phase)  
- Multi-hospital SaaS tenancy (single-hospital Jalaram mode only)  
- Load testing at scale  

### Important pilot principle

Do **not** enter real patient data until:

1. HTTPS is working  
2. Daily PostgreSQL backups are scheduled and a restore has been tested once  
3. All staff passwords have been changed from defaults  
4. Clinical and IT sign-off on the go-live checklist  

---

## 2. Architecture overview

AfyaSasa runs as **six Docker containers** on a single VPS:

| Container | Image / build | Role | Internet exposure |
|-----------|---------------|------|-------------------|
| **nginx** | nginx:1.27-alpine | Public entry — serves UI and proxies `/api/` to backend | **Yes** — via host Nginx on 443 → Docker on `127.0.0.1:8080` |
| **frontend** | Built from `frontend/` | React single-page application | Internal Docker network only |
| **backend** | Built from `backend/` | NestJS REST API + WebSocket (notifications) | Internal only |
| **postgres** | postgres:16 | Clinical database (schema `demo`, tenant code `jalaram`) | Internal only — **never publish 5432** |
| **redis** | redis:7 | Cache and job queue | Internal only — **never publish 6379** |
| **minio** | minio/minio | S3-compatible clinical file storage | Internal only — **never publish 9000/9001** |

### Traffic flow (production)

```
Browser (Kenya)
    │
    ▼ HTTPS :443
Host Nginx (TLS termination, Certbot)
    │
    ▼ HTTP 127.0.0.1:8080
Docker Nginx container
    ├── /          → frontend:80  (React UI)
    ├── /api/      → backend:3000/api/
    └── /socket.io/ → backend:3000/socket.io/  (real-time notifications)
```

### Production compose files

Always use **both** compose files together:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

`docker-compose.prod.yml` removes public ports from Postgres, Redis, MinIO, backend, and frontend. It binds Docker Nginx to **`127.0.0.1:8080:80`** so only the host reverse proxy is internet-facing.

### Recommended directory layout on VPS

```
/opt/afyasasa/          ← application root (git clone)
├── .env                ← production secrets (never commit)
├── backups/            ← PostgreSQL dumps
├── docker-compose.yml
├── docker-compose.prod.yml
├── backend/
├── frontend/
├── infra/nginx.conf
└── ops/                ← backup, test, reset scripts
```

---

## 3. Prerequisites checklist

Complete before ordering the VPS or starting deployment.

| # | Item | Owner | Done |
|---|------|-------|------|
| 1 | Domain or subdomain decided (e.g. `emr.jalaram.co.ke`) | IT | ☐ |
| 2 | DNS access to create A record | IT | ☐ |
| 3 | Git repository access or release tarball | Dev | ☐ |
| 4 | Contabo account (or alternative VPS provider) | IT | ☐ |
| 5 | SSH key pair for server access | IT | ☐ |
| 6 | Strong passwords plan (Postgres, JWT, MinIO) | IT | ☐ |
| 7 | Celcom SMS keys (optional — stub mode OK for pilot) | IT | ☐ |
| 8 | Staff account list for Jalaram (`@jalaram.co.ke`) | Admin | ☐ |
| 9 | Go-live checklist printed or shared | Clinical lead | ☐ |
| 10 | Backup storage location (same VPS + offsite copy plan) | IT | ☐ |

### Minimum skills required

- SSH and basic Linux administration  
- Editing text files (`nano` / `vim`)  
- Understanding of Docker Compose  
- Basic Nginx configuration  

---

## 4. Contabo VPS selection and ordering

### Recommended specifications

| Resource | Minimum | Recommended (pilot) | Notes |
|----------|---------|---------------------|-------|
| RAM | 4 GB | **8 GB** | Postgres + MinIO + builds need headroom |
| vCPU | 2 | **4** | Faster Docker builds and concurrent users |
| SSD | 80 GB | **160 GB** | Room for DB growth, MinIO files, backups |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS | Long-term support |
| Location | EU (Germany) | Measure latency | Kenya users may prefer local VPS for production |

Contabo is suitable for **pilot and staging**. After deployment, measure page load times from Jalaram's network. If latency is unacceptable, consider a Kenya-region VPS (e.g. Truehost) using this same guide.

### Contabo-specific steps

1. Log in to [Contabo Customer Control Panel](https://my.contabo.com/)  
2. Order **VPS** with Ubuntu 22.04  
3. Note the **public IPv4 address**  
4. Set root password or upload SSH public key during setup  
5. Optional: enable Contabo **external firewall** — allow only ports 22, 80, 443  

### After VPS is provisioned

```bash
ssh root@YOUR_VPS_IP
```

Verify connectivity and note the IP for DNS.

---

## 5. Domain name and DNS

### Example domain

Use a dedicated subdomain for the EMR:

- `emr.jalaram.co.ke` (recommended)  
- or `afya.jalaramhospital.com`  

### DNS records

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `emr` | `YOUR_VPS_IP` | 300–3600 |
| CNAME (optional) | `www.emr` | `emr.jalaram.co.ke` | 3600 |

### Verify propagation

```bash
dig +short emr.jalaram.co.ke
# Must return YOUR_VPS_IP
```

Wait 5–60 minutes after creating the record. Certbot will fail if DNS does not resolve.

---

## 6. Initial server setup

### 6.1 Create deploy user

SSH as root, then:

```bash
adduser afyasasa
usermod -aG sudo afyasasa
mkdir -p /home/afyasasa/.ssh
cp ~/.ssh/authorized_keys /home/afyasasa/.ssh/
chown -R afyasasa:afyasasa /home/afyasasa/.ssh
chmod 700 /home/afyasasa/.ssh
chmod 600 /home/afyasasa/.ssh/authorized_keys
```

Log out and reconnect as the deploy user:

```bash
ssh afyasasa@YOUR_VPS_IP
```

### 6.2 System updates and essential packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw fail2ban htop unzip
```

### 6.3 Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

**Do not** open 5432, 6379, 3000, 8080, 9000, or 9001 to the public internet.

### 6.4 SSH hardening (after key login confirmed)

```bash
sudo nano /etc/ssh/sshd_config
```

Set:

```
PasswordAuthentication no
PermitRootLogin prohibit-password
```

Then:

```bash
sudo systemctl reload sshd
```

### 6.5 Fail2ban

Installed above. Default jails protect SSH. Verify:

```bash
sudo systemctl status fail2ban
```

### 6.6 Set timezone (optional but recommended)

```bash
sudo timedatectl set-timezone Africa/Nairobi
timedatectl
```

---

## 7. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker compose version
```

Expected output includes `Docker Compose version v2.x`.

### Enable Docker on boot

```bash
sudo systemctl enable docker
sudo systemctl start docker
```

---

## 8. Deploy application code

### 8.1 Create application directory

```bash
sudo mkdir -p /opt/afyasasa
sudo chown $USER:$USER /opt/afyasasa
cd /opt/afyasasa
```

### 8.2 Clone repository

Replace with your actual repository URL:

```bash
git clone https://github.com/YOUR_ORG/Afya-Sasa.git .
```

Or upload a release tarball:

```bash
# From your laptop:
scp afyasasa-release.tar.gz afyasasa@YOUR_VPS_IP:/opt/afyasasa/
# On VPS:
cd /opt/afyasasa && tar xzf afyasasa-release.tar.gz --strip-components=1
```

### 8.3 Create backup directory

```bash
mkdir -p /opt/afyasasa/backups
```

---

## 9. Production environment configuration

### 9.1 Create `.env` from template

```bash
cd /opt/afyasasa
cp .env.example .env
nano .env
```

**Never commit `.env` to git.**

### 9.2 Required production values

Copy and customize the block below. Generate secrets with `openssl rand -base64 48`.

```env
# --- Application ---
NODE_ENV=production
PORT=3000
FRONTEND_ORIGIN=https://emr.jalaram.co.ke
APP_PUBLIC_URL=https://emr.jalaram.co.ke

# --- PostgreSQL ---
POSTGRES_DB=afyasasa
POSTGRES_USER=afyasasa
POSTGRES_PASSWORD=<GENERATE-strong-password>
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
DEFAULT_TENANT_SCHEMA=demo
DEFAULT_TENANT_CODE=jalaram
HOSPITAL_NUMBER_PREFIX=JH
TYPEORM_MIGRATIONS_RUN=true

# --- Redis ---
REDIS_HOST=redis
REDIS_PORT=6379

# --- JWT (generate unique values) ---
JWT_ACCESS_SECRET=<GENERATE-48-byte-secret>
JWT_REFRESH_SECRET=<GENERATE-different-48-byte-secret>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# --- MinIO / S3 (internal Docker hostnames) ---
MINIO_ROOT_USER=afyasasa
MINIO_ROOT_PASSWORD=<GENERATE-strong-password>
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY_ID=afyasasa
S3_SECRET_ACCESS_KEY=<same-as-MINIO-or-separate-key>
S3_BUCKET=afyasasa-clinical-files
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true

# --- SMS (stub until Celcom keys approved) ---
SMS_PROVIDER=stub
SMS_SENDER_NAME=JALARAM

# --- Email (optional — leave blank until SMTP ready) ---
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@jalaram.co.ke

# --- Frontend build args (used by Docker Compose build) ---
VITE_DEFAULT_TENANT=jalaram
VITE_HIDE_TENANT_SELECTOR=true
VITE_API_BASE_URL=/api/v1
```

### 9.3 Variable reference

| Variable | Purpose |
|----------|---------|
| `FRONTEND_ORIGIN` | CORS and WebSocket allowed origin — must match exact browser URL including `https://` |
| `APP_PUBLIC_URL` | Links in emails and system messages |
| `DEFAULT_TENANT_CODE=jalaram` | Single-hospital mode; login hides tenant selector |
| `DEFAULT_TENANT_SCHEMA=demo` | Internal PostgreSQL schema name (legacy; tenant code is `jalaram`) |
| `TYPEORM_MIGRATIONS_RUN=true` | Auto-run DB migrations on backend startup |
| `VITE_HIDE_TENANT_SELECTOR=true` | Login screen does not ask for hospital code |
| `SMS_PROVIDER=stub` | SMS logged but not sent until Celcom keys configured |

### 9.4 Generate secrets

```bash
openssl rand -base64 48   # run once per secret needed
```

Use a **different** value for each of: `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MINIO_ROOT_PASSWORD`, `S3_SECRET_ACCESS_KEY`.

### 9.5 Pre-deploy validation (optional, on VPS or CI)

If Node.js/npm is installed on the VPS:

```bash
cd /opt/afyasasa
npm run preflight:prod
```

This checks Docker, `.env`, builds, and runs a smoke test. On a minimal VPS you may skip the npm build steps and proceed directly to Docker Compose.

---

## 10. Build and start the stack

From `/opt/afyasasa`:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

First build may take **10–20 minutes** depending on VPS CPU and network.

### 10.1 Watch startup logs

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend
```

Wait for:

```
Nest application successfully started
```

Migrations run automatically when `TYPEORM_MIGRATIONS_RUN=true`.

### 10.2 Verify all containers

```bash
docker compose ps
```

All services should show `running` (minio-init shows `exited` with code 0 — that is normal).

### 10.3 Health check (before TLS)

Docker Nginx listens on **127.0.0.1:8080** only:

```bash
curl -fsS http://127.0.0.1:8080/api/v1/health
```

Expected:

```json
{"status":"ok","service":"afyasasa-backend"}
```

Open in browser (HTTP, temporary):

```
http://YOUR_VPS_IP:8080/
```

Port 8080 is bound to localhost only, so use SSH tunnel for remote testing before TLS:

```bash
# From your laptop:
ssh -L 8080:127.0.0.1:8080 afyasasa@YOUR_VPS_IP
# Then open http://localhost:8080
```

---

## 11. Verify migrations and tenant

### 11.1 Confirm Jalaram tenant exists

```bash
docker compose exec postgres psql -U afyasasa -d afyasasa -c \
  "SELECT code, name, active FROM public.tenants WHERE code = 'jalaram';"
```

Expected: one row with `jalaram`, active.

### 11.2 Confirm admin user exists

```bash
docker compose exec postgres psql -U afyasasa -d afyasasa -c \
  "SELECT email, active, force_password_change FROM demo.users WHERE email = 'it@jalaram.co.ke';"
```

### 11.3 Confirm migrations table

```bash
docker compose exec postgres psql -U afyasasa -d afyasasa -c \
  "SELECT COUNT(*) FROM public.migrations;"
```

Count should be greater than zero after first successful startup.

---

## 12. HTTPS with Let's Encrypt

Production must use HTTPS. Use **host Nginx** as TLS terminator; Docker Nginx stays on `127.0.0.1:8080`.

### 12.1 Install host Nginx and Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 12.2 Create Nginx site configuration

```bash
sudo nano /etc/nginx/sites-available/afyasasa
```

Paste the following (replace `emr.jalaram.co.ke` with your domain):

```nginx
server {
    listen 80;
    server_name emr.jalaram.co.ke;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:8080/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

Enable the site:

```bash
sudo ln -sf /etc/nginx/sites-available/afyasasa /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 12.3 Obtain TLS certificate

```bash
sudo certbot --nginx -d emr.jalaram.co.ke
```

Follow prompts. Choose redirect HTTP to HTTPS when asked.

Certbot auto-renewal is installed via systemd timer:

```bash
sudo systemctl status certbot.timer
```

### 12.4 Update `.env` for HTTPS

Ensure these match your live URL:

```env
FRONTEND_ORIGIN=https://emr.jalaram.co.ke
APP_PUBLIC_URL=https://emr.jalaram.co.ke
```

Rebuild frontend if you changed origin after first build:

```bash
cd /opt/afyasasa
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build frontend nginx
```

### 12.5 Verify HTTPS

```bash
curl -fsS https://emr.jalaram.co.ke/api/v1/health
```

Open `https://emr.jalaram.co.ke` in a browser — login page should show Jalaram branding.

---

## 13. First login and account hardening

### 13.1 Default administrator credentials

| Field | Value |
|-------|-------|
| URL | `https://emr.jalaram.co.ke` |
| Email | `it@jalaram.co.ke` |
| Initial password | `ChangeMe123!` |
| Tenant code | Hidden — defaults to `jalaram` |

You will be prompted to change the password on first login.

### 13.2 Reset admin password (if login fails)

From `/opt/afyasasa` on the VPS:

```bash
npm run db:reset-admin
```

Or directly:

```bash
bash ops/reset-demo-admin.sh
```

This resets `it@jalaram.co.ke` to `ChangeMe123!` and clears lockouts.

### 13.3 Reset all Jalaram staff passwords

```bash
npm run db:reset-staff
```

Resets all active `@jalaram.co.ke` accounts to `ChangeMe123!` with forced change on login.

### 13.4 Post-login hardening tasks

| Task | Where |
|------|-------|
| Change admin password | Login prompt / Account Center |
| Verify staff accounts | Admin → Users |
| Disable unused demo accounts | Admin → Users |
| Confirm hospital name/logo on login | Login screen (from database) |
| Enable Pharmacy module if needed | Hospital Control Center → Modules |
| Do not expose Swagger publicly | Block `/docs` at host Nginx or IP allowlist |

### 13.5 Restrict Swagger in production (recommended)

Add to host Nginx HTTPS server block:

```nginx
location /docs {
    deny all;
    return 404;
}
```

Reload Nginx after change.

---

## 14. Post-deploy testing

### 14.1 Smoke test (from VPS)

```bash
cd /opt/afyasasa
BACKEND_URL=http://127.0.0.1:8080/api/v1 \
FRONTEND_URL=http://127.0.0.1:8080 \
TENANT=jalaram \
bash ops/smoke-test.sh
```

Note: smoke test also probes Swagger on port 3000 internally — in production the important checks are health and login via port 8080.

### 14.2 Full workflow test suite

Run all API acceptance tests:

```bash
cd /opt/afyasasa
API=http://127.0.0.1:8080/api/v1 TENANT=jalaram npm run test:workflows
```

This runs:

| Script | Workflow |
|--------|----------|
| `ops/smoke-test.sh` | Health + login |
| `ops/opd-workflow-test.sh` | OPD check-in → triage → consult |
| `ops/ipd-workflow-test.sh` | Admission → discharge |
| `ops/lab-workflow-test.sh` | Lab order → result → review |
| `ops/radiology-workflow-test.sh` | Imaging order → report |
| `ops/inventory-workflow-test.sh` | Stock, requisition, transfer |
| `ops/pharmacy-workflow-test.sh` | Prescribe → dispense |

All scripts must pass before inviting clinical staff.

### 14.3 External HTTPS test (from laptop)

```bash
curl -fsS https://emr.jalaram.co.ke/api/v1/health
```

Manual UI walkthrough: see `docs/core-workflow-test-plan.md`.

---

## 15. Backups and disaster recovery

### 15.1 PostgreSQL backup (daily)

Use the project script:

```bash
cd /opt/afyasasa
npm run db:backup
# Writes to backups/afyasasa-YYYYMMDD-HHMMSS.sql
```

Or with gzip for cron:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /opt/afyasasa
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
docker compose exec -T postgres pg_dump \
  -U afyasasa afyasasa --clean --if-exists \
  | gzip > "backups/afyasasa-${STAMP}.sql.gz"
find backups -name '*.sql.gz' -mtime +14 -delete
echo "Backup complete: backups/afyasasa-${STAMP}.sql.gz"
```

Save as `/opt/afyasasa/ops/cron-backup.sh`, chmod +x.

### 15.2 Schedule daily backup

```bash
crontab -e
```

Add:

```
0 2 * * * /opt/afyasasa/ops/cron-backup.sh >> /opt/afyasasa/backups/backup.log 2>&1
```

### 15.3 Restore test (mandatory once before live data)

```bash
cd /opt/afyasasa
gunzip -c backups/afyasasa-YYYYMMDDTHHMMSSZ.sql.gz | \
  docker compose exec -T postgres psql -U afyasasa -d afyasasa
```

Or for uncompressed dump:

```bash
npm run db:restore -- backups/afyasasa-YYYYMMDD-HHMMSS.sql
```

Verify login and a sample patient record after restore.

### 15.4 MinIO / clinical files backup

MinIO data lives in Docker volume `afyasasa_minio-data`.

List volumes:

```bash
docker volume ls | grep minio
```

Backup options:

1. **Volume archive:** `docker run --rm -v afyasasa_minio-data:/data -v /opt/afyasasa/backups:/backup alpine tar czf /backup/minio-$(date +%Y%m%d).tar.gz -C /data .`  
2. **MinIO client mirror** to external S3 or another server (install `mc` on host)  

Schedule weekly MinIO backups at minimum.

### 15.5 Offsite copies

Copy `backups/*.sql.gz` and MinIO archives to:

- Separate cloud storage (Google Drive, S3, Backblaze)  
- Second server  
- Encrypted external drive (weekly physical rotation)  

**A backup that exists only on the same VPS as production is not disaster recovery.**

---

## 16. Updates, redeploy, and rollback

### 16.1 Standard update procedure

```bash
cd /opt/afyasasa
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose logs -f backend --tail 80
```

Migrations apply automatically on backend restart.

### 16.2 Post-update verification

```bash
API=http://127.0.0.1:8080/api/v1 TENANT=jalaram npm run test:workflows
```

### 16.3 Rollback if update fails

1. Stop stack: `docker compose -f docker-compose.yml -f docker-compose.prod.yml down`  
2. Checkout previous git tag/commit: `git checkout <previous-tag>`  
3. Restore database from last good backup if migrations broke schema  
4. Rebuild and start: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`  

Always take a backup **before** major updates.

---

## 17. Monitoring and maintenance

### 17.1 Daily checks

| Check | Command |
|-------|---------|
| Containers running | `docker compose ps` |
| API health | `curl -fsS https://emr.jalaram.co.ke/api/v1/health` |
| Disk space | `df -h` |
| Memory | `free -h` |
| Recent errors | `docker compose logs backend --since 24h 2>&1 \| grep -i error \| tail -20` |
| Backup file exists | `ls -lh /opt/afyasasa/backups/` |

### 17.2 Docker log rotation

Create `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  }
}
```

Then: `sudo systemctl restart docker` (brief downtime — schedule maintenance window).

### 17.3 Auto-start on reboot

Docker service is enabled via systemd. Containers use `restart: unless-stopped` if added to compose; verify after reboot:

```bash
sudo reboot
# After reconnect:
docker compose ps
curl -fsS http://127.0.0.1:8080/api/v1/health
```

---

## 18. Celcom SMS integration

When Celcom Africa approves your API keys:

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

Test a single SMS from Admin → Notifications before enabling appointment reminders or bulk sends.

---

## 19. Security hardening

### Network

- Only ports **22, 80, 443** open on UFW and Contabo firewall  
- Postgres, Redis, MinIO, backend **not** published to `0.0.0.0`  
- MinIO console (9001) **not** exposed in production compose  

### Secrets

- Rotate all defaults from `.env.example` before go-live  
- Store `.env` with permissions `chmod 600 .env`  
- Never commit `.env` or paste secrets in chat/email  

### Application

- RBAC enforced on backend — frontend nav hiding is not security  
- Force password change for all staff after reset  
- Pilot under **supervised** clinical use until UAT sign-off  

### SSH

- Key-based auth only (disable password auth)  
- Consider changing SSH port (optional)  
- fail2ban active  

### TLS

- Certbot auto-renewal enabled  
- HSTS can be added after stable HTTPS (optional advanced step)  

---

## 20. Troubleshooting reference

| Problem | Likely cause | Fix |
|---------|--------------|-----|
| `502 Bad Gateway` | Backend not running | `docker compose ps`; `docker compose logs backend` |
| `502` after TLS | Host Nginx wrong upstream | Confirm `proxy_pass http://127.0.0.1:8080` |
| Migrations fail | Wrong Postgres password | Match `.env` to volume; or recreate volume (data loss) |
| Login fails | Wrong password / lockout | `npm run db:reset-admin` |
| Login fails | Wrong tenant | Ensure `VITE_DEFAULT_TENANT=jalaram` and rebuild frontend |
| Blank white page | Frontend build error | `docker compose ... up -d --build frontend` |
| CORS errors | Origin mismatch | `FRONTEND_ORIGIN` must exactly match browser URL |
| WebSocket / notifications dead | Missing upgrade headers | Add `/socket.io/` block to host Nginx (Section 12.2) |
| Certbot fails | DNS not propagated | `dig +short your.domain`; wait and retry |
| Slow from Kenya | EU VPS latency | Measure; consider Kenya-region VPS |
| `npm run deploy:prod` issues | Wrong compose file | Use both files: `-f docker-compose.yml -f docker-compose.prod.yml` |
| Out of disk | Logs or backups | `df -h`; prune: `docker system prune -a` (careful) |

### Useful diagnostic commands

```bash
# Container logs
docker compose logs backend --tail 100
docker compose logs nginx --tail 50

# Enter Postgres
docker compose exec postgres psql -U afyasasa -d afyasasa

# Test login via API
curl -sS -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant: jalaram" \
  -d '{"email":"it@jalaram.co.ke","password":"ChangeMe123!","device":"curl"}'
```

---

## 21. Post-deploy sign-off checklist

| # | Item | Pass |
|---|------|------|
| 1 | HTTPS works in browser | ☐ |
| 2 | Login page shows Jalaram hospital name | ☐ |
| 3 | Admin login + password change works | ☐ |
| 4 | `npm run test:workflows` all green | ☐ |
| 5 | Daily Postgres backup scheduled | ☐ |
| 6 | Restore test completed once | ☐ |
| 7 | MinIO backup plan documented | ☐ |
| 8 | Staff passwords changed from default | ☐ |
| 9 | Swagger not publicly accessible | ☐ |
| 10 | Clinical UAT started (`docs/go-live-checklist.md`) | ☐ |

---

## 22. Quick command reference

```bash
# Start (production)
cd /opt/afyasasa
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Stop
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# Logs
docker compose logs -f backend

# Health (local)
curl -fsS http://127.0.0.1:8080/api/v1/health

# Health (public)
curl -fsS https://emr.jalaram.co.ke/api/v1/health

# Smoke test
BACKEND_URL=http://127.0.0.1:8080/api/v1 FRONTEND_URL=http://127.0.0.1:8080 TENANT=jalaram bash ops/smoke-test.sh

# Full workflow tests
API=http://127.0.0.1:8080/api/v1 TENANT=jalaram npm run test:workflows

# Backup
npm run db:backup

# Reset admin
npm run db:reset-admin
```

**Pilot URL:** `https://emr.jalaram.co.ke` (replace with your domain)  
**Admin:** `it@jalaram.co.ke` / `ChangeMe123!` (change immediately)  
**Tenant:** `jalaram` (hidden on login)

---

## 23. Related documents

| Document | Purpose |
|----------|---------|
| `docs/go-live-checklist.md` | Full clinical and IT sign-off |
| `docs/core-workflow-test-plan.md` | Manual UAT scenarios by role |
| `docs/core-workflow-gap-matrix.md` | Feature completeness matrix |
| `docs/go-live-readiness-directive.md` | Master readiness plan |
| `docs/local-testing-guide.md` | Local development testing |
| `docs/inventory-architecture.md` | Pharmacy and store design |
| `docs/contabo-deployment-guide.md` | Short deployment summary |

---

*End of document — AfyaSasa Contabo Deployment Guide v1.1*
