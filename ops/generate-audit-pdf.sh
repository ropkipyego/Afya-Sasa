#!/usr/bin/env bash
# Convert audit markdown to styled HTML and PDF via headless Chrome
set -euo pipefail

MD_FILE="${1:?Usage: generate-audit-pdf.sh <audit.md>}"
OUT_DIR="$(dirname "$MD_FILE")"
BASE="$(basename "$MD_FILE" .md)"
HTML_FILE="${OUT_DIR}/${BASE}.html"
PDF_FILE="${OUT_DIR}/${BASE}.pdf"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq required" >&2
  exit 1
fi

# Simple md→html (headers, tables, lists) — sufficient for audit report
python3 << PY
import re, pathlib, html as h
md = pathlib.Path("$MD_FILE").read_text()
lines = md.splitlines()
out = []
in_table = False
for line in lines:
    if line.startswith("# "):
        out.append(f"<h1>{h.escape(line[2:])}</h1>")
    elif line.startswith("## "):
        out.append(f"<h2>{h.escape(line[3:])}</h2>")
    elif line.startswith("### "):
        out.append(f"<h3>{h.escape(line[4:])}</h3>")
    elif line.startswith("|") and "|" in line[1:]:
        cells = [c.strip() for c in line.strip("|").split("|")]
        if all(set(c) <= set("-:") for c in cells):
            continue
        tag = "th" if not in_table else "td"
        if not in_table:
            out.append("<table>")
            in_table = True
        row = "".join(f"<{tag}>{h.escape(c)}</{tag}>" for c in cells)
        out.append(f"<tr>{row}</tr>")
    else:
        if in_table and not line.startswith("|"):
            out.append("</table>")
            in_table = False
        if line.startswith("- [ ]"):
            out.append(f"<p class='check'>☐ {h.escape(line[6:])}</p>")
        elif line.startswith("- "):
            out.append(f"<li>{h.escape(line[2:])}</li>")
        elif line.startswith("**") and line.endswith("**"):
            out.append(f"<p><strong>{h.escape(line.strip('*'))}</strong></p>")
        elif line.strip() == "":
            out.append("")
        elif line.startswith("---"):
            out.append("<hr/>")
        elif line.startswith("*") and line.endswith("*"):
            out.append(f"<p class='muted'>{h.escape(line.strip('*'))}</p>")
        else:
            out.append(f"<p>{h.escape(line)}</p>")
if in_table:
    out.append("</table>")
body = "\n".join(out)
html = f"""<!DOCTYPE html>
<html><head><meta charset='utf-8'>
<title>AfyaSasa System Audit</title>
<style>
  @page {{ size: A4; margin: 18mm 15mm; }}
  @media print {{
    body {{ max-width: none; }}
    h2, h3 {{ page-break-after: avoid; }}
    table {{ page-break-inside: auto; }}
    tr {{ page-break-inside: avoid; }}
  }}
  body {{ font-family: 'Segoe UI', system-ui, sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.5; width: 100%; margin: 0; padding: 24px; box-sizing: border-box; }}
  h1 {{ color: #0f766e; border-bottom: 3px solid #14b8a6; padding-bottom: 8px; }}
  h2 {{ color: #334155; margin-top: 28px; }}
  h3 {{ color: #475569; }}
  table {{ width: 100%; border-collapse: collapse; margin: 12px 0 20px; font-size: 10pt; }}
  th, td {{ border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }}
  th {{ background: #f1f5f9; font-weight: 700; }}
  tr:nth-child(even) td {{ background: #f8fafc; }}
  .PASS {{ color: #047857; font-weight: 700; }}
  .FAIL {{ color: #b91c1c; font-weight: 700; }}
  .WARN {{ color: #b45309; font-weight: 700; }}
  .check {{ margin: 4px 0; }}
  .muted {{ color: #64748b; font-size: 9pt; }}
  li {{ margin: 4px 0; }}
  ul {{ margin: 8px 0 16px 20px; padding: 0; }}
  hr {{ border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }}
</style></head><body>
{body.replace('>PASS<', ' class="PASS">PASS<').replace('>FAIL<', ' class="FAIL">FAIL<').replace('>WARN<', ' class="WARN">WARN<')}
</body></html>"""
pathlib.Path("$HTML_FILE").write_text(html)
print("HTML written:", "$HTML_FILE")
PY

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
  --virtual-time-budget=10000 \
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
