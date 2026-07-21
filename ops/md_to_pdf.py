#!/usr/bin/env python3
"""Convert AfyaSasa markdown reports to print-ready HTML."""
from __future__ import annotations

import html as h
import pathlib
import re
import sys


def inline_fmt(text: str) -> str:
    escaped = h.escape(text)
    escaped = re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", escaped)
    escaped = re.sub(r"(?<![*\\])\*([^*]+)\*(?!\*)", r"<em>\1</em>", escaped)
    return escaped


def md_to_html(md: str) -> tuple[str, str]:
    lines = md.splitlines()
    out: list[str] = []
    in_table = False
    in_ul = False
    in_ol = False
    doc_title = "AfyaSasa Document"

    def close_lists() -> None:
        nonlocal in_ul, in_ol
        if in_ul:
            out.append("</ul>")
            in_ul = False
        if in_ol:
            out.append("</ol>")
            in_ol = False

    def close_table() -> None:
        nonlocal in_table
        if in_table:
            out.append("</table>")
            in_table = False

    for line in lines:
        if line.startswith("# "):
            close_lists()
            close_table()
            title = line[2:].strip()
            if doc_title == "AfyaSasa Document":
                doc_title = title
            out.append(f"<h1>{inline_fmt(title)}</h1>")
        elif line.startswith("## "):
            close_lists()
            close_table()
            out.append(f"<h2>{inline_fmt(line[3:].strip())}</h2>")
        elif line.startswith("### "):
            close_lists()
            close_table()
            out.append(f"<h3>{inline_fmt(line[4:].strip())}</h3>")
        elif line.startswith("|") and "|" in line[1:]:
            close_lists()
            cells = [c.strip() for c in line.strip("|").split("|")]
            if all(set(c) <= set("-: ") for c in cells):
                continue
            tag = "th" if not in_table else "td"
            if not in_table:
                out.append("<table>")
                in_table = True
            row = "".join(f"<{tag}>{inline_fmt(c)}</{tag}>" for c in cells)
            out.append(f"<tr>{row}</tr>")
        elif re.match(r"^\d+\.\s+", line):
            close_table()
            if in_ul:
                out.append("</ul>")
                in_ul = False
            if not in_ol:
                out.append("<ol>")
                in_ol = True
            item = re.sub(r"^\d+\.\s+", "", line)
            out.append(f"<li>{inline_fmt(item)}</li>")
        elif line.startswith("- [ ]"):
            close_table()
            if in_ol:
                out.append("</ol>")
                in_ol = False
            if not in_ul:
                out.append("<ul class='checklist'>")
                in_ul = True
            out.append(f"<li class='check'>☐ {inline_fmt(line[6:])}</li>")
        elif line.startswith("- "):
            close_table()
            if in_ol:
                out.append("</ol>")
                in_ol = False
            if not in_ul:
                out.append("<ul>")
                in_ul = True
            out.append(f"<li>{inline_fmt(line[2:])}</li>")
        else:
            close_lists()
            if in_table and not line.startswith("|"):
                close_table()
            if line.strip() == "":
                out.append("")
            elif line.startswith("---"):
                out.append("<hr/>")
            else:
                out.append(f"<p>{inline_fmt(line)}</p>")

    close_lists()
    close_table()
    body = "\n".join(out)
    html = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>{h.escape(doc_title)}</title>
<style>
  @page {{ size: A4; margin: 16mm 14mm 18mm 14mm; }}
  @media print {{
    body {{ max-width: none; }}
    h2 {{ page-break-after: avoid; }}
    h3 {{ page-break-after: avoid; }}
    table {{ page-break-inside: auto; }}
    tr {{ page-break-inside: avoid; }}
  }}
  body {{
    font-family: 'Segoe UI', Calibri, system-ui, sans-serif;
    font-size: 10.5pt;
    color: #1e293b;
    line-height: 1.55;
    width: 100%;
    margin: 0;
    padding: 18px 22px 28px;
    box-sizing: border-box;
  }}
  h1 {{
    color: #0f766e;
    font-size: 20pt;
    border-bottom: 3px solid #14b8a6;
    padding-bottom: 10px;
    margin-top: 0;
    line-height: 1.25;
  }}
  h2 {{
    color: #0f172a;
    font-size: 14pt;
    margin-top: 26px;
    border-left: 4px solid #14b8a6;
    padding-left: 10px;
  }}
  h3 {{
    color: #334155;
    font-size: 11.5pt;
    margin-top: 18px;
  }}
  p {{ margin: 6px 0 10px; }}
  table {{
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0 18px;
    font-size: 9.2pt;
  }}
  th, td {{
    border: 1px solid #cbd5e1;
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
  }}
  th {{ background: #ecfdf5; font-weight: 700; color: #115e59; }}
  tr:nth-child(even) td {{ background: #f8fafc; }}
  code {{
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.92em;
    background: #f1f5f9;
    padding: 1px 5px;
    border-radius: 4px;
  }}
  ul, ol {{ margin: 6px 0 14px 22px; padding: 0; }}
  li {{ margin: 4px 0; }}
  ul.checklist {{ list-style: none; margin-left: 8px; }}
  .check {{ margin: 3px 0; }}
  .PASS {{ color: #047857; font-weight: 700; }}
  .FAIL {{ color: #b91c1c; font-weight: 700; }}
  .WARN {{ color: #b45309; font-weight: 700; }}
  hr {{ border: none; border-top: 1px solid #e2e8f0; margin: 22px 0; }}
  strong {{ color: #0f172a; }}
  em {{ color: #475569; }}
  .footer-note {{
    margin-top: 28px;
    padding-top: 10px;
    border-top: 1px solid #e2e8f0;
    font-size: 8.5pt;
    color: #64748b;
  }}
</style></head><body>
{body}
<div class="footer-note">AfyaSasa · Jalaram Hospital profile · Generated from markdown · Confidential hospital operations document</div>
</body></html>"""
    html = (
        html.replace(">PASS<", ' class="PASS">PASS<')
        .replace(">FAIL<", ' class="FAIL">FAIL<')
        .replace(">WARN<", ' class="WARN">WARN<')
    )
    return html, doc_title


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: md_to_pdf.py <input.md> <output.html>", file=sys.stderr)
        return 2
    md_path = pathlib.Path(sys.argv[1])
    html_path = pathlib.Path(sys.argv[2])
    html, title = md_to_html(md_path.read_text())
    html_path.write_text(html)
    print(f"HTML written: {html_path}")
    print(f"Title: {title}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
