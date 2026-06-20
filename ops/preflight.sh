#!/usr/bin/env bash
set -euo pipefail

missing=0

check_command() {
  local command_name="$1"
  local install_hint="$2"

  if command -v "$command_name" >/dev/null 2>&1; then
    echo "OK: ${command_name} -> $($command_name --version 2>/dev/null | head -n 1 || true)"
  else
    echo "MISSING: ${command_name}"
    echo "  ${install_hint}"
    missing=1
  fi
}

echo "AfyaSasa local preflight"
echo "======================="

check_command docker "Install Docker Engine or Docker Desktop."

if command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then
    echo "OK: docker compose -> $(docker compose version)"
  else
    echo "MISSING: docker compose plugin"
    echo "  Install Docker Compose v2 plugin."
    missing=1
  fi
fi

if command -v npm >/dev/null 2>&1; then
  echo "OK: npm -> $(npm --version)"
else
  echo "OPTIONAL MISSING: npm"
  echo "  npm is only needed for npm run shortcuts. You can use docker compose directly."
fi

if [[ ! -f .env ]]; then
  echo "MISSING: .env"
  echo "  Run: cp .env.example .env"
  missing=1
else
  echo "OK: .env exists"
fi

echo
if [[ "$missing" -eq 0 ]]; then
  echo "Preflight passed. Start with: npm run dev"
else
  echo "Preflight found missing requirements. Fix the items above, then rerun: npm run preflight"
  exit 1
fi
