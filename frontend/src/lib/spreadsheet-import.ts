const EXCEL_EXTENSIONS = new Set(['.xlsx', '.xls'])

const SPREADSHEET_ACCEPT =
  '.csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export const SPREADSHEET_UPLOAD_ACCEPT = SPREADSHEET_ACCEPT

function extensionOf(file: File) {
  const name = file.name.toLowerCase()
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot) : ''
}

export async function readSpreadsheetAsCsv(file: File): Promise<string> {
  const ext = extensionOf(file)
  const mime = (file.type || '').toLowerCase()
  const isExcel =
    EXCEL_EXTENSIONS.has(ext) ||
    mime.includes('spreadsheet') ||
    mime === 'application/vnd.ms-excel'

  if (!isExcel) {
    return file.text()
  }

  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames.find((name) => {
    const sheet = workbook.Sheets[name]
    return Boolean(sheet && XLSX.utils.sheet_to_json(sheet, { header: 1 }).length)
  })
  if (!sheetName) {
    throw new Error('That Excel file has no usable worksheet.')
  }
  return XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], {
    FS: ',',
    RS: '\n',
    blankrows: false,
  })
}
