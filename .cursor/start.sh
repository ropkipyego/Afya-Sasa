#!/usr/bin/env bash
# Per-boot startup for the AfyaSasa Cloud Agent environment.
# Starts the Docker daemon, reapplies the nested-networking fix, and brings the
# Compose stack up. Idempotent: safe to run when things are already running.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[start] Ensuring Docker daemon is running..."
if ! sudo docker info >/dev/null 2>&1; then
  sudo service docker start || true
  for _ in $(seq 1 30); do
    sudo docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi
sudo docker info >/dev/null 2>&1 || { echo "[start] Docker daemon is not available" >&2; exit 1; }

# Reapply the nested-container bridge networking fix (kernel setting, not persisted).
sudo modprobe br_netfilter 2>/dev/null || true
sudo sysctl -w net.bridge.bridge-nf-call-iptables=0 || true
sudo sysctl -w net.bridge.bridge-nf-call-ip6tables=0 || true

if [ ! -f .env ]; then
  cp .env.example .env
fi

echo "[start] Bringing up the AfyaSasa stack..."
sudo docker compose up -d

# Best-effort readiness wait for the backend (does not fail the boot if slow).
for _ in $(seq 1 30); do
  if curl -fsS http://localhost:3000/api/v1/health >/dev/null 2>&1; then
    echo "[start] Backend healthy."
    break
  fi
  sleep 2
done

echo "[start] AfyaSasa is up: app http://localhost:8080  API http://localhost:3000/api/v1  Swagger http://localhost:3000/docs"
