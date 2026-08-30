#!/usr/bin/env bash
# Run all API workflow acceptance scripts
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export API="${API:-http://localhost:3000/api/v1}"
export TENANT="${TENANT:-jalaram}"

scripts=(
  "ops/smoke-test.sh"
  "ops/opd-workflow-test.sh"
  "ops/ipd-workflow-test.sh"
  "ops/lab-workflow-test.sh"
  "ops/radiology-workflow-test.sh"
  "ops/inventory-workflow-test.sh"
  "ops/pharmacy-workflow-test.sh"
  "ops/emergency-workflow-test.sh"
  "ops/storage-workflow-test.sh"
)

echo "AfyaSasa workflow test suite"
echo "API=${API} TENANT=${TENANT}"
echo ""

for script in "${scripts[@]}"; do
  echo "▶ ${script}"
  bash "${ROOT}/${script}"
  echo ""
done

echo "══════════════════════════════════════"
echo "All workflow tests passed."
echo "══════════════════════════════════════"
