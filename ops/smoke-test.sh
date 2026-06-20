#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:3000/api/v1}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:8080}"
TENANT="${TENANT:-demo}"
EMAIL="${EMAIL:-admin@demo.afyasasa.local}"
PASSWORD="${PASSWORD:-ChangeMe123!}"

echo "AfyaSasa smoke test"
echo "==================="

require_curl() {
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required for the smoke test." >&2
    exit 1
  fi
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local tries="${3:-60}"

  echo "Waiting for ${label}: ${url}"
  for _ in $(seq 1 "$tries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "OK: ${label}"
      return 0
    fi
    sleep 2
  done

  echo "FAILED: ${label} did not respond at ${url}" >&2
  return 1
}

require_curl

wait_for_url "${BACKEND_URL}/health" "backend health"
wait_for_url "${FRONTEND_URL}" "frontend"
wait_for_url "http://localhost:3000/docs" "Swagger docs"

echo "Testing demo login for ${EMAIL}"
login_response="$(
  curl -fsS -X POST "${BACKEND_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -H "X-Tenant: ${TENANT}" \
    --data "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"device\":\"smoke-test\"}"
)"

if [[ "$login_response" == *"accessToken"* ]]; then
  echo "OK: demo login returned an access token"
else
  echo "FAILED: login did not return an access token" >&2
  echo "$login_response" >&2
  exit 1
fi

echo
echo "Smoke test passed."
