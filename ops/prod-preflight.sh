#!/usr/bin/env bash
# Production readiness checks before Contabo/VPS deploy
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

missing=0
warn=0

check() {
  local label="$1"
  local cmd="$2"
  if eval "$cmd" >/dev/null 2>&1; then
    echo "OK: $label"
  else
    echo "FAIL: $label"
    missing=1
  fi
}

warn_if() {
  local label="$1"
  local cmd="$2"
  if eval "$cmd" >/dev/null 2>&1; then
    echo "OK: $label"
  else
    echo "WARN: $label"
    warn=1
  fi
}

echo "AfyaSasa production preflight"
echo "=============================="

check "docker" "command -v docker"
check "docker compose" "docker compose version"
check ".env exists" "test -f .env"

if [[ -f .env ]]; then
  grep -q 'JWT_SECRET=change-me' .env && { echo "FAIL: JWT_SECRET still default"; missing=1; } || echo "OK: JWT_SECRET customized"
  grep -q 'POSTGRES_PASSWORD=afyasasa' .env && { echo "WARN: POSTGRES_PASSWORD is default"; warn=1; } || echo "OK: POSTGRES_PASSWORD customized"
  grep -q 'DEFAULT_TENANT_CODE=jalaram' .env && echo "OK: tenant code jalaram" || echo "WARN: DEFAULT_TENANT_CODE not jalaram"
fi

check "backend build" "npm --prefix backend run build"
check "frontend build" "npm --prefix frontend run build"

echo ""
echo "Starting stack for smoke test…"
docker compose -f docker-compose.prod.yml up -d --build 2>/dev/null || docker compose up -d --build

sleep 12
if bash ops/smoke-test.sh; then
  echo "OK: smoke test"
else
  echo "FAIL: smoke test"
  missing=1
fi

echo ""
if [[ "$missing" -eq 0 ]]; then
  echo "Production preflight passed${warn:+ (with warnings)}."
  echo "Next: configure TLS + backups per docs/contabo-deployment-guide.md"
  exit 0
else
  echo "Production preflight failed. Fix items above before go-live."
  exit 1
fi
