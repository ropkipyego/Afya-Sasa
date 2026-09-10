export async function previewWordDocument(blob: Blob): Promise<string> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await blob.arrayBuffer()
  const result = await mammoth.default.convertToHtml({ arrayBuffer })
  return result.value || '<p>No preview content.</p>'
}

export async function previewExcelDocument(blob: Blob): Promise<string> {
  return `<div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
    <p class="font-semibold">Spreadsheet preview disabled</p>
    <p class="mt-1">This file is ${(blob.size / 1024).toFixed(1)} KB. Download it to inspect the spreadsheet locally.</p>
  </div>`
}
