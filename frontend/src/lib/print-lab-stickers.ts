import { openPrintHtml } from './template-engine'

export type LabSticker = {
  barcode: string
  patientName: string
  patientNo: string
  sample: string
  requestNo?: string
}

const CODE39: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  '*': 'nwnnwnwnn',
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function code39Svg(value: string) {
  const payload = `*${value.toUpperCase().replace(/[^A-Z0-9\-. ]/g, '-') }*`
  const units: string[] = []
  for (const char of payload) {
    const pattern = CODE39[char] ?? CODE39['-']
    units.push(pattern)
  }
  const bits = units.join('n')
  let x = 0
  const bars: string[] = []
  for (const unit of bits) {
    const wide = unit === 'w'
    const width = wide ? 3 : 1
    if (bars.length % 2 === 0) {
      bars.push(`<rect x="${x}" y="0" width="${width}" height="40" fill="#0f172a"/>`)
    }
    x += width
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="44" viewBox="0 0 ${x} 40" role="img" aria-label="${escapeHtml(value)}">${bars.join('')}</svg>`
}

export function printLabStickers(stickers: LabSticker[]) {
  if (!stickers.length) return
  const cards = stickers
    .map(
      (sticker) => `
      <article class="sticker">
        ${code39Svg(sticker.barcode)}
        <p class="barcode">${escapeHtml(sticker.barcode)}</p>
        <p class="name">${escapeHtml(sticker.patientName)}</p>
        <p class="meta"><strong>No.</strong> ${escapeHtml(sticker.patientNo)}</p>
        <p class="sample">${escapeHtml(sticker.sample)}</p>
        ${sticker.requestNo ? `<p class="meta">${escapeHtml(sticker.requestNo)}</p>` : ''}
      </article>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Lab sample stickers</title>
  <style>
    @page { size: 50mm 30mm; margin: 2mm; }
    body { font-family: system-ui, sans-serif; margin: 0; color: #0f172a; }
    .sticker {
      width: 46mm;
      min-height: 26mm;
      padding: 2mm;
      page-break-after: always;
      border: 1px solid #e2e8f0;
    }
    svg { width: 100%; height: 12mm; }
    .barcode { margin: 1mm 0 0; font-family: ui-monospace, monospace; font-size: 8px; letter-spacing: 0.04em; }
    .name { margin: 1mm 0 0; font-size: 11px; font-weight: 700; }
    .sample { margin: 0.5mm 0 0; font-size: 10px; font-weight: 600; }
    .meta { margin: 0.4mm 0 0; font-size: 8px; color: #334155; }
  </style>
</head>
<body>${cards}</body>
</html>`
  openPrintHtml(html, `Lab stickers (${stickers.length})`)
}
