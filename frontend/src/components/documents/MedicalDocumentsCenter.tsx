import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileUp, Printer, Search } from 'lucide-react'
import { Button, Card, Input, PageHeader, SelectField } from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { PatientTimeline, type TimelineEvent } from '../PatientTimeline'
import { apiRequest } from '../../lib/api'
import {
  listPatientDocuments,
  uploadPatientDocument,
  type ClinicalDocumentRow,
  type ClinicalDocumentType,
} from '../../lib/clinical-documents'
import { downloadClinicalFile, viewClinicalFile } from '../../lib/clinical-upload'
import { notify } from '../../lib/notify'

type SickSheetRow = {
  id: string
  diagnosis: string
  daysOff: number
  startDate: string
  endDate: string
  doctorName: string
  createdAt: string
}

const documentTypes = [
  'referral',
  'lab_result',
  'radiology',
  'consultation',
  'visit',
  'admission',
] as const

const uploadTypes: { value: ClinicalDocumentType; label: string }[] = [
  { value: 'consent', label: 'Consent form' },
  { value: 'insurance', label: 'Insurance document' },
  { value: 'scanned_record', label: 'Scanned record' },
  { value: 'lab_attachment', label: 'Lab attachment' },
  { value: 'radiology_pdf', label: 'Radiology PDF' },
  { value: 'medical_certificate', label: 'Medical certificate' },
  { value: 'discharge_summary', label: 'Discharge summary' },
  { value: 'other', label: 'Other' },
]

const typeLabels: Record<string, string> = {
  referral: 'Referral letter',
  lab_result: 'Laboratory report',
  radiology: 'Radiology report',
  consultation: 'Medical report',
  visit: 'Visit record',
  admission: 'Discharge / admission',
  sick_sheet: 'Sick sheet',
  stored_file: 'Uploaded file',
  lab_pdf: 'Lab report PDF',
}

export function MedicalDocumentsCenter() {
  const queryClient = useQueryClient()
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchItem | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [uploadType, setUploadType] = useState<ClinicalDocumentType>('scanned_record')
  const [uploading, setUploading] = useState(false)

  const { data: timeline, isLoading } = useQuery({
    queryKey: ['documents-timeline', selectedPatient?.id],
    queryFn: () =>
      apiRequest<{ events: TimelineEvent[] }>(`/patients/${selectedPatient!.id}/timeline`),
    enabled: Boolean(selectedPatient?.id),
  })

  const { data: sickSheets = [] } = useQuery({
    queryKey: ['sick-sheets', selectedPatient?.id],
    queryFn: () => apiRequest<SickSheetRow[]>(`/opd/sick-sheets?patientId=${selectedPatient!.id}`),
    enabled: Boolean(selectedPatient?.id),
  })

  const { data: storedFiles = [] } = useQuery({
    queryKey: ['clinical-documents', selectedPatient?.id],
    queryFn: () => listPatientDocuments(selectedPatient!.id),
    enabled: Boolean(selectedPatient?.id),
  })

  const { data: labAttachments = [] } = useQuery({
    queryKey: ['lab-patient-attachments', selectedPatient?.id],
    queryFn: () =>
      apiRequest<
        {
          id: string
          filename: string
          title?: string | null
          storagePath: string
          createdAt: string
          requestNo?: string
        }[]
      >(`/laboratory/patients/${selectedPatient!.id}/attachments`),
    enabled: Boolean(selectedPatient?.id),
  })

  const documents = useMemo(() => {
    const events = (timeline?.events ?? [])
      .filter((e) => documentTypes.includes(e.type as (typeof documentTypes)[number]) || e.type === 'lab_request')
      .map((e) => ({
        id: e.id,
        type: e.type,
        title: e.title,
        summary: e.summary,
        occurredAt: e.occurredAt,
        source: 'timeline' as const,
      }))

    const sheets = sickSheets.map((s) => ({
      id: s.id,
      type: 'sick_sheet',
      title: `Sick sheet — ${s.diagnosis}`,
      summary: `${s.daysOff} days · Dr. ${s.doctorName}`,
      occurredAt: s.createdAt,
      source: 'timeline' as const,
    }))

    const files = storedFiles.map((f: ClinicalDocumentRow) => ({
      id: f.id,
      type: 'stored_file',
      title: f.title,
      summary: `${f.filename} · ${f.documentType.replace(/_/g, ' ')}`,
      occurredAt: f.createdAt,
      source: 'file' as const,
      file: f,
    }))

    const labPdfs = labAttachments.map((attachment) => ({
      id: attachment.id,
      type: 'lab_pdf',
      title: attachment.title ?? attachment.filename,
      summary: attachment.requestNo ? `Lab request ${attachment.requestNo}` : 'Laboratory PDF report',
      occurredAt: attachment.createdAt,
      source: 'lab_pdf' as const,
      storagePath: attachment.storagePath,
      filename: attachment.filename,
    }))

    let combined = [...events, ...sheets, ...files, ...labPdfs]
    if (typeFilter !== 'all') {
      combined = combined.filter((d) => d.type === typeFilter || (typeFilter === 'stored_file' && d.source === 'file'))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      combined = combined.filter(
        (d) => d.title.toLowerCase().includes(q) || d.summary.toLowerCase().includes(q),
      )
    }
    return combined.sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )
  }, [timeline, sickSheets, storedFiles, labAttachments, typeFilter, search])

  const handleUpload = async (file: File) => {
    if (!selectedPatient) return
    setUploading(true)
    try {
      await uploadPatientDocument(selectedPatient.id, file, uploadType)
      notify('Document uploaded', 'File stored in clinical document archive.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['clinical-documents', selectedPatient.id] })
    } catch (error) {
      notify('Upload failed', (error as Error).message, 'critical')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="workspace-shell animate-fade-in">
      <Card className="p-5 md:p-8">
        <PageHeader
          title="Medical documents center"
          description="Timeline events, sick sheets, and uploaded files — metadata in database, files in object storage."
        />
        <div className="mt-6 max-w-xl">
          <PatientSearchAutocomplete selected={selectedPatient} onSelect={setSelectedPatient} />
        </div>
      </Card>

      {selectedPatient ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Search documents…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">All types</option>
                {Object.entries(typeLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[180px] flex-1">
                  <SelectField
                    name="uploadType"
                    label="Document type"
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value as ClinicalDocumentType)}
                  >
                    {uploadTypes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </SelectField>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">
                  <FileUp className="h-4 w-4" />
                  {uploading ? 'Uploading…' : 'Upload file'}
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,image/*,.doc,.docx"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void handleUpload(file)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
            </div>

            {isLoading ? (
              <div className="mt-6 space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 animate-skeleton rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="mt-6 space-y-2">
                {documents.map((doc) => (
                  <div
                    key={`${doc.type}-${doc.id}`}
                    className="card-hover flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex gap-3">
                      <FileUp className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
                      <div>
                        <p className="font-semibold">{doc.title}</p>
                        <p className="text-xs text-slate-500">
                          {typeLabels[doc.type] ?? doc.type} ·{' '}
                          {new Date(doc.occurredAt).toLocaleString()}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">{doc.summary}</p>
                      </div>
                    </div>
                    {'file' in doc && doc.file ? (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={async () => {
                            try {
                              await viewClinicalFile(doc.file!.storagePath)
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
                              await downloadClinicalFile(doc.file!.storagePath, doc.file!.filename)
                            } catch (error) {
                              notify('Download failed', (error as Error).message, 'critical')
                            }
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : 'storagePath' in doc && doc.storagePath ? (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={async () => {
                            try {
                              await viewClinicalFile(doc.storagePath)
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
                              await viewClinicalFile(doc.storagePath)
                            } catch (error) {
                              notify('Print failed', (error as Error).message, 'critical')
                            }
                          }}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={async () => {
                            try {
                              await downloadClinicalFile(doc.storagePath, doc.filename)
                            } catch (error) {
                              notify('Download failed', (error as Error).message, 'critical')
                            }
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
                {!documents.length ? (
                  <p className="py-12 text-center text-sm text-slate-500">No documents match.</p>
                ) : null}
              </div>
            )}
          </Card>

          <PatientTimeline
            events={(timeline?.events ?? []).slice(0, 12)}
            title="Patient timeline"
            description="Clinical events for this patient"
          />
        </div>
      ) : (
        <Card>
          <p className="py-16 text-center text-slate-500">Search and select a patient to view documents.</p>
        </Card>
      )}
    </div>
  )
}
