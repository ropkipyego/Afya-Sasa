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

  const presigned = await apiRequest<{ key: string; url: string }>(
    '/storage/presign-upload',
    {
      method: 'POST',
      body: JSON.stringify({
        key,
        contentType: file.type || 'application/octet-stream',
        folder,
      }),
    },
  )

  const uploadResponse = await fetch(presigned.url, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
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
