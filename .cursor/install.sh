#!/usr/bin/env bash
# One-time, idempotent setup for the AfyaSasa Cloud Agent environment.
# Prepares Docker (the repo's only runtime dependency) and pre-builds the
# Compose images so a fresh boot only has to `docker compose up`.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[install] Ensuring Docker Engine + Compose are available..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sudo sh /tmp/get-docker.sh
fi

# The Cloud Agent VM is itself a container. The overlayfs/containerd snapshotter
# cannot apply image whiteout files here (no CAP_MKNOD), so use the vfs storage
# driver, which stores each layer as a plain directory and needs no whiteouts.
echo "[install] Configuring Docker daemon for nested-container use (vfs)..."
sudo mkdir -p /etc/docker
echo '{"features":{"containerd-snapshotter":false},"storage-driver":"vfs"}' \
  | sudo tee /etc/docker/daemon.json >/dev/null

sudo groupadd -f docker
sudo usermod -aG docker "$USER" || true

echo "[install] Starting Docker daemon..."
sudo service docker restart
for _ in $(seq 1 30); do
  sudo docker info >/dev/null 2>&1 && break
  sleep 1
done
sudo docker info >/dev/null 2>&1 || { echo "[install] Docker daemon failed to start" >&2; exit 1; }

# Same-bridge container-to-container traffic is otherwise dropped by a stale
# legacy iptables FORWARD chain (policy DROP) that Docker does not populate.
# Disabling bridge netfilter lets intra-network L2 traffic flow.
echo "[install] Relaxing bridge netfilter for container-to-container networking..."
sudo modprobe br_netfilter 2>/dev/null || true
sudo sysctl -w net.bridge.bridge-nf-call-iptables=0 || true
sudo sysctl -w net.bridge.bridge-nf-call-ip6tables=0 || true

if [ ! -f .env ]; then
  echo "[install] Creating .env from .env.example..."
  cp .env.example .env
fi

echo "[install] Pulling base images and building application images..."
sudo docker compose pull --quiet postgres redis minio minio-init nginx || true
sudo docker compose build

echo "[install] Done."
