/** Client-side upload limits — keep in sync with backend/src/storage/storage.constants.ts */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export const ALLOWED_UPLOAD_ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,application/pdf,image/*,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const ALLOWED_MIME_PREFIXES = ['image/']
const ALLOWED_MIME_EXACT = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
])

export function validateClinicalUploadFile(file: File): void {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File is too large (max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB).`)
  }

  const ext = file.name.includes('.') ? `.${file.name.split('.').pop()!.toLowerCase()}` : ''
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`File type not allowed: ${ext}. Use PDF, images, Word, or Excel (.xlsx).`)
  }

  const mime = (file.type || '').toLowerCase()
  if (
    mime &&
    !ALLOWED_MIME_EXACT.has(mime) &&
    !ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))
  ) {
    throw new Error(`File type not allowed: ${mime || 'unknown'}.`)
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
