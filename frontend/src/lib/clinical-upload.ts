import { apiRequest } from './api'

export type UploadedClinicalFile = {
  filename: string
  mimeType: string
  storagePath: string
  fileSize: number
}

export async function uploadClinicalFile(
  file: File,
  folder: string,
  requestId: string,
): Promise<UploadedClinicalFile> {
  const safeName = file.name.replace(/[^\w.-]+/g, '_')
  const key = `${folder}/${requestId}/${Date.now()}-${safeName}`

  const presigned = await apiRequest<{ key: string; url: string }>('/storage/presign-upload', {
    method: 'POST',
    body: JSON.stringify({
      key,
      contentType: file.type || 'application/octet-stream',
      folder,
    }),
  })

  const uploadResponse = await fetch(presigned.url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  })

  if (!uploadResponse.ok) {
    throw new Error('File upload failed. Please try again.')
  }

  return {
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    storagePath: presigned.key,
    fileSize: file.size,
  }
}

export async function downloadClinicalFile(
  storagePath: string,
  filename?: string,
): Promise<void> {
  const presigned = await apiRequest<{ url: string }>('/storage/presign-download', {
    method: 'POST',
    body: JSON.stringify({ key: storagePath }),
  })

  const response = await fetch(presigned.url)
  if (!response.ok) {
    throw new Error('Unable to download file. Please try again.')
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename ?? storagePath.split('/').pop() ?? 'download'
  anchor.click()
  URL.revokeObjectURL(url)
}
