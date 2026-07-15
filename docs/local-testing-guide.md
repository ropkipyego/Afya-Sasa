# AfyaSasa Local Testing Guide

This guide assumes you want to run the full app locally from a fresh machine.

## Recommended setup

Use **Ubuntu 22.04 or 24.04 LTS** if you have a choice. It is the easiest environment for Docker Compose, ports, logs, and backup scripts.

You do **not** need to install PostgreSQL, Redis, MinIO, or Nginx manually. Docker Compose runs them.

## Option A: Ubuntu machine

### 1. Install Git

```bash
sudo apt update
sudo apt install -y git ca-certificates curl
```

### 2. Install Docker Engine

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 3. Allow your user to run Docker

```bash
sudo usermod -aG docker "$USER"
newgrp docker
```

Check:

```bash
docker --version
docker compose version
```

### 4. Install Node/npm only for shortcut scripts

The app itself runs in Docker, but root `npm run ...` shortcuts need npm.

```bash
sudo apt install -y nodejs npm
```

If you skip Node/npm, use `docker compose ...` commands directly.

## Option B: Windows or macOS

Install:

- Git
- Docker Desktop
- Node.js LTS

Then run the same project commands from a terminal.

## Running the app

```bash
git clone <repo-url>
cd Afya-Sasa
cp .env.example .env
npm run preflight
npm run dev
```

If you do not have npm:

```bash
cp .env.example .env
docker compose up --build
```

## URLs

- App through Nginx: http://localhost:8080
- Frontend container direct: http://localhost:5173
- Backend API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/docs
- MinIO console: http://localhost:9001

## Demo accounts

Tenant: `demo`

Password: `ChangeMe123!`

| Role | Email |
|---|---|
| Administrator | `it@jalaram.co.ke` |
| Doctor | `doctor@jalaram.co.ke` |
| Nurse | `nurse@jalaram.co.ke` |
| Records Officer | `records@jalaram.co.ke` |
| Lab Technician | `lab@jalaram.co.ke` |
| Radiology Technician | `radiology@jalaram.co.ke` |

The admin account is forced to change password on first login.

## Smoke test

Start the app in detached mode:

```bash
npm run dev:detached
```

Then run:

```bash
npm run smoke
```

This checks:

- backend health endpoint
- frontend response
- Swagger response
- demo login

## Useful commands

```bash
npm run logs
npm run stop
npm run dev:fresh
npm run db:backup
npm run db:restore -- backups/afyasasa-file.sql
```

`npm run dev:fresh` deletes Docker volumes and rebuilds from scratch. Use it when you want migrations and seed data to rerun.

## If startup fails

1. Check Docker is running:

```bash
docker ps
```

2. Check logs:

```bash
npm run logs
```

3. Reset and rebuild:

```bash
npm run dev:fresh
```

4. Check ports are free:

- 3000 backend
- 5173 frontend direct
- 5432 PostgreSQL
- 6379 Redis
- 8080 Nginx app
- 9000 MinIO API
- 9001 MinIO console

If a port is already in use, stop the other service or change the port mapping in `docker-compose.yml`.
