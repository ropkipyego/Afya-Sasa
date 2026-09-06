import { useEffect, useMemo, useState } from 'react'
import { Download, FileSpreadsheet, FileText, X } from 'lucide-react'
import { Button } from '../ui'
import { downloadClinicalFile, fetchClinicalFileBlob, viewClinicalFile } from '../../lib/clinical-upload'
import { previewExcelDocument, previewWordDocument } from '../../lib/document-preview'

type DocumentViewerModalProps = {
  open: boolean
  onClose: () => void
  title: string
  filename: string
  mimeType: string
  storagePath: string
  autoDownload?: boolean
}

function fileKind(mimeType: string, filename: string) {
  const lower = `${mimeType} ${filename}`.toLowerCase()
  if (lower.includes('pdf')) return 'pdf'
  if (lower.includes('word') || lower.includes('docx') || lower.endsWith('.doc')) return 'word'
  if (lower.includes('sheet') || lower.includes('excel') || lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return 'excel'
  }
  return 'other'
}

export function DocumentViewerModal({
  open,
  onClose,
  title,
  filename,
  mimeType,
  storagePath,
  autoDownload = false,
}: DocumentViewerModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [richHtml, setRichHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const kind = useMemo(() => fileKind(mimeType, filename), [mimeType, filename])

  useEffect(() => {
    if (!open) return
    if (autoDownload && kind !== 'pdf' && kind !== 'word' && kind !== 'excel') {
      void downloadClinicalFile(storagePath, filename)
    }
  }, [open, autoDownload, kind, storagePath, filename])

  useEffect(() => {
    if (!open) {
      setPreviewUrl(null)
      setRichHtml(null)
      setError(null)
      return
    }

    let cancelled = false
    let objectUrl: string | null = null
    setLoading(true)
    setError(null)
    setPreviewUrl(null)
    setRichHtml(null)

    void fetchClinicalFileBlob(storagePath)
      .then(async (blob) => {
        if (cancelled) return
        if (kind === 'pdf') {
          objectUrl = URL.createObjectURL(blob)
          setPreviewUrl(objectUrl)
          return
        }
        if (kind === 'word') {
          const html = await previewWordDocument(blob)
          if (!cancelled) setRichHtml(html)
          return
        }
        if (kind === 'excel') {
          const html = await previewExcelDocument(blob)
          if (!cancelled) setRichHtml(html)
          return
        }
        if (autoDownload) {
          await downloadClinicalFile(storagePath, filename)
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [open, kind, storagePath, filename, autoDownload])

  if (!open) return null

  const Icon = kind === 'excel' ? FileSpreadsheet : FileText

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-lg font-bold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">{filename}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => void downloadClinicalFile(storagePath, filename)}>
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button type="button" variant="ghost" onClick={onClose} aria-label="Close">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50 p-4">
          {loading ? (
            <div className="flex h-[70vh] items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-teal-200 border-t-teal-700" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
              {error}. Use Download to open the file locally.
            </div>
          ) : kind === 'pdf' && previewUrl ? (
            <iframe title={title} src={previewUrl} className="h-[70vh] w-full rounded-xl border border-slate-200 bg-white" />
          ) : richHtml ? (
            <div
              className="doc-rich-preview min-h-[50vh] overflow-x-auto rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-800"
              dangerouslySetInnerHTML={{ __html: richHtml }}
            />
          ) : (
            <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <div className="mb-4 rounded-2xl bg-slate-100 p-5">
                <Icon className="h-12 w-12 text-teal-700" />
              </div>
              <p className="text-lg font-semibold text-slate-900">Document file</p>
              <p className="mt-2 max-w-md text-sm text-slate-600">Preview is not available for this format.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button type="button" onClick={() => void downloadClinicalFile(storagePath, filename)}>
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button type="button" variant="secondary" onClick={() => void viewClinicalFile(storagePath)}>
                  Open in new tab
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
