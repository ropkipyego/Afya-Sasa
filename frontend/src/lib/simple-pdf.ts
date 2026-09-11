function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function wrapLine(text: string, width = 92): string[] {
  const words = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
  if (!words[0]) return ['']
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > width) {
      if (current) lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

export function buildSimplePdfBlob(title: string, lines: string[]): Blob {
  const commands: string[] = []
  let y = 800
  commands.push(`BT /F1 16 Tf 50 ${y} Td (${escapePdfText(title)}) Tj ET`)
  y -= 28
  for (const raw of lines) {
    for (const line of wrapLine(raw)) {
      if (y < 60) break
      commands.push(`BT /F1 10 Tf 50 ${y} Td (${escapePdfText(line)}) Tj ET`)
      y -= 14
    }
    y -= 4
  }
  const stream = commands.join('\n')
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${new TextEncoder().encode(stream).length} >> stream\n${stream}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ]
  let offset = 9
  const xref = ['xref', '0 6', '0000000000 65535 f ']
  const bodyParts = ['%PDF-1.4']
  for (const object of objects) {
    xref.push(`${String(offset).padStart(10, '0')} 00000 n `)
    bodyParts.push(object)
    offset += new TextEncoder().encode(`${object}\n`).length
  }
  const body = `${bodyParts.join('\n')}\n`
  const startxref = new TextEncoder().encode(body).length
  const pdf = `${body}${xref.join('\n')}\ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`
  return new Blob([pdf], { type: 'application/pdf' })
}
