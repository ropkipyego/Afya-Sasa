import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileUp } from 'lucide-react'
import { useState } from 'react'
import { apiRequest } from '../../lib/api'
import { downloadClinicalFile, uploadClinicalFile, viewClinicalFile } from '../../lib/clinical-upload'
import { ALLOWED_UPLOAD_ACCEPT, formatFileSize } from '../../lib/upload-limits'
import { notify } from '../../lib/notify'
import { Alert, Button, Card, FileUploadZone } from '../ui'

type EncounterAttachment = {
  id: string
  filename: string
  mimeType: string
  fileSize: number
  storagePath: string
  createdAt: string
}

export function EncounterAttachmentsPanel({
  encounterId,
  title = 'Encounter files',
  description = 'Upload consent forms, referral letters, or scanned records for this visit.',
}: {
  encounterId: string
  title?: string
  description?: string
}) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)

  const { data: encounter, isLoading } = useQuery({
    queryKey: ['encounter-attachments', encounterId],
    queryFn: () =>
      apiRequest<{ attachments: EncounterAttachment[] }>(`/opd/encounters/${encounterId}`),
  })

  const attachments = encounter?.attachments ?? []

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a file to upload.')
      const uploaded = await uploadClinicalFile(file, 'encounters', encounterId)
      return apiRequest<EncounterAttachment>(`/opd/encounters/${encounterId}/attachments`, {
        method: 'POST',
        body: JSON.stringify({
          filename: uploaded.filename,
          mimeType: uploaded.mimeType,
          storagePath: uploaded.storagePath,
          fileSize: uploaded.fileSize,
        }),
      })
    },
    onSuccess: async () => {
      notify('File attached', 'Document linked to this encounter.', 'success')
      setFile(null)
      await queryClient.invalidateQueries({ queryKey: ['encounter-attachments', encounterId] })
    },
    onError: (error: Error) => notify('Upload failed', error.message, 'critical'),
  })

  return (
    <Card className="p-5 md:p-8">
      <div className="flex items-start gap-3">
        <FileUp className="mt-1 h-5 w-5 shrink-0 text-teal-600" />
        <div>
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
      </div>

      <div className="mt-6 max-w-xl space-y-3">
        <FileUploadZone
          accept={ALLOWED_UPLOAD_ACCEPT}
          file={file}
          onFileChange={setFile}
          hint="PDF, JPEG, PNG, WebP, or Word — max 25 MB"
        />
        <Button
          type="button"
          disabled={!file || upload.isPending}
          loading={upload.isPending}
          onClick={() => upload.mutate()}
        >
          Upload to encounter
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-6 h-24 animate-skeleton rounded-xl" />
      ) : attachments.length ? (
        <ul className="mt-6 space-y-2">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3"
            >
              <div>
                <p className="font-semibold text-slate-900">{attachment.filename}</p>
                <p className="text-xs text-slate-500">
                  {formatFileSize(attachment.fileSize)} · {new Date(attachment.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await viewClinicalFile(attachment.storagePath)
                    } catch (error) {
                      notify('View failed', (error as Error).message, 'critical')
                    }
                  }}
                >
                  View
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await downloadClinicalFile(attachment.storagePath, attachment.filename)
                    } catch (error) {
                      notify('Download failed', (error as Error).message, 'critical')
                    }
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Alert tone="info" className="mt-6">
          No files attached to this encounter yet.
        </Alert>
      )}
    </Card>
  )
}
