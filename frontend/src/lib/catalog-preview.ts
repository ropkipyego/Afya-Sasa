export type CatalogMatchKind = 'EXISTING MATCH' | 'NEW' | 'AMBIGUOUS' | 'DUPLICATE' | 'REVIEW'

export function normalizeCatalogName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(test|serum|blood|stool|urine)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseSimpleCsv(csv: string): Array<Record<string, string>> {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const headers = splitCsvLine(lines[0]).map((header) =>
    header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
  )
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? '').trim()
    })
    return row
  })
}

function splitCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        quoted = !quoted
      }
    } else if (char === ',' && !quoted) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells
}

export function classifyAgainstCatalog(
  row: { code?: string; name?: string },
  catalog: Array<{ code: string; name: string }>,
  seen: Set<string>,
): { kind: CatalogMatchKind; matchCodes: string[] } {
  const code = (row.code ?? '').trim().toUpperCase()
  const name = (row.name ?? '').trim()
  const identity = `${code}|${normalizeCatalogName(name)}`
  if (seen.has(identity) || (code && seen.has(code))) {
    return { kind: 'DUPLICATE', matchCodes: [] }
  }
  if (code) seen.add(code)
  seen.add(identity)

  if (code) {
    const exact = catalog.filter((item) => item.code.toUpperCase() === code)
    if (exact.length === 1) return { kind: 'EXISTING MATCH', matchCodes: [exact[0].code] }
    if (exact.length > 1) return { kind: 'AMBIGUOUS', matchCodes: exact.map((item) => item.code) }
  }
  if (name) {
    const key = normalizeCatalogName(name)
    const byName = catalog.filter((item) => normalizeCatalogName(item.name) === key)
    if (byName.length === 1) return { kind: 'EXISTING MATCH', matchCodes: [byName[0].code] }
    if (byName.length > 1) return { kind: 'AMBIGUOUS', matchCodes: byName.map((item) => item.code) }
  }
  if (!code && !name) return { kind: 'REVIEW', matchCodes: [] }
  return { kind: 'NEW', matchCodes: [] }
}
