#!/usr/bin/env bash
# Convert audit / product markdown to styled HTML and PDF via headless Chrome
set -euo pipefail

MD_FILE="${1:?Usage: generate-audit-pdf.sh <document.md>}"
OUT_DIR="$(dirname "$MD_FILE")"
BASE="$(basename "$MD_FILE" .md)"
HTML_FILE="${OUT_DIR}/${BASE}.html"
PDF_FILE="${OUT_DIR}/${BASE}.pdf"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

python3 "$SCRIPT_DIR/md_to_pdf.py" "$MD_FILE" "$HTML_FILE"

CHROME=""
for c in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$c" >/dev/null 2>&1; then CHROME="$c"; break; fi
done

if [[ -z "$CHROME" ]]; then
  echo "No Chrome/Chromium found — HTML only: ${HTML_FILE}" >&2
  exit 0
fi

HTML_ABS="$(cd "$(dirname "$HTML_FILE")" && pwd)/$(basename "$HTML_FILE")"
PDF_ABS="$(cd "$(dirname "$PDF_FILE")" && pwd)/$(basename "$PDF_FILE")"

"$CHROME" --headless=new --disable-gpu --no-sandbox \
  --run-all-compositor-stages-before-draw \
  --virtual-time-budget=15000 \
  --print-to-pdf-no-header \
  --print-to-pdf="$PDF_ABS" \
  "file://${HTML_ABS}" 2>/dev/null

if [[ -f "$PDF_FILE" ]]; then
  pages="$(pdfinfo "$PDF_FILE" 2>/dev/null | awk '/Pages:/ {print $2}' || echo '?')"
  echo "PDF written: ${PDF_FILE} (${pages} page(s))"
else
  echo "PDF generation failed — use HTML: ${HTML_FILE}" >&2
  exit 1
fi
