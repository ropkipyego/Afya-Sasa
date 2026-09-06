export async function previewWordDocument(blob: Blob): Promise<string> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await blob.arrayBuffer()
  const result = await mammoth.default.convertToHtml({ arrayBuffer })
  return result.value || '<p>No preview content.</p>'
}

export async function previewExcelDocument(blob: Blob): Promise<string> {
  const XLSX = await import('xlsx')
  const arrayBuffer = await blob.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return '<p>Empty spreadsheet.</p>'
  const sheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_html(sheet, { id: 'doc-preview-sheet' })
}
