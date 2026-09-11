import { useAuthStore } from './auth-store'
import { validateClinicalUploadFile } from './upload-limits'

export type UploadedClinicalFile = {
  filename: string
  mimeType: string
  storagePath: string
  fileSize: number
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export async function fetchClinicalFileBlob(storagePath: string): Promise<Blob> {
  const { tenant, accessToken } = useAuthStore.getState()
  const response = await fetch(`${API_BASE}/storage/fetch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant': tenant,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ key: storagePath }),
  })
  if (!response.ok) {
    if (response.status === 404) throw new Error('Document was not found.')
    if (response.status === 403) throw new Error('You do not have permission to open this document.')
    if (response.status === 401) throw new Error('Your session expired. Sign in again.')
    throw new Error('Unable to retrieve file. Please try again.')
  }
  const buffer = await response.arrayBuffer()
  const type = response.headers.get('Content-Type') || 'application/octet-stream'
  return new Blob([buffer], { type })
}

export async function uploadClinicalFile(
  file: File,
  folder: string,
  requestId: string,
): Promise<UploadedClinicalFile> {
  validateClinicalUploadFile(file)

  const { tenant, accessToken } = useAuthStore.getState()
  const form = new FormData()
  form.append('file', file)
  form.append('folder', folder)
  form.append('requestId', requestId)

  const response = await fetch(`${API_BASE}/storage/upload`, {
    method: 'POST',
    headers: {
      'X-Tenant': tenant,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: form,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'File upload failed. Please try again.')
  }

  const payload = (await response.json()) as {
    filename: string
    mimeType: string
    storagePath: string
    fileSize: number
  }

  return {
    filename: payload.filename,
    mimeType: payload.mimeType,
    storagePath: payload.storagePath,
    fileSize: payload.fileSize,
  }
}

export async function viewClinicalFile(storagePath: string): Promise<void> {
  const blob = await fetchClinicalFileBlob(storagePath)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function downloadClinicalFile(
  storagePath: string,
  filename?: string,
): Promise<void> {
  const blob = await fetchClinicalFileBlob(storagePath)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename ?? storagePath.split('/').pop() ?? 'download'
  anchor.click()
  URL.revokeObjectURL(url)
}
