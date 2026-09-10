import { useEffect, useMemo, useRef, useState } from 'react'
import { formDataFromElement } from '../../lib/form-utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Download,
  FileUp,
  Plus,
  Printer,
  TestTube,
  Trash2,
} from 'lucide-react'
import { Button, Field, SelectField } from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { ClinicalInvestigationOrders } from './ClinicalInvestigationOrders'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'
import { printLabStickers } from '../../lib/print-lab-stickers'
import { formatPatientNoShort } from '../../lib/patient-utils'
import { openPatientFile } from '../../lib/patient-file'
import { downloadClinicalFile, uploadClinicalFile, viewClinicalFile } from '../../lib/clinical-upload'
import {
  LabKanbanColumn,
  LabModal,
  LabPatientStrip,
  LabQueueItem,
  LabSection,
  waitLabel,
} from './lab-ui'

type LabAttachment = {
  id: string
  filename: string
  mimeType: string
  storagePath: string
  title?: string | null
  createdAt: string
}

type LabSampleRow = {
  id: string
  barcode: string
  type: string
  testName?: string
}

type LabRequestRow = {
  id: string
  status: string
  priority: string
  createdAt: string
  requestNo?: string
  patient?: { id?: string; firstName: string; lastName: string; patientNo: string }
  items?: {
    id: string
    status: string
    test?: { name: string }
    panel?: { name: string }
    orderableTest?: { name: string; code?: string }
  }[]
  samples?: LabSampleRow[]
  attachments?: LabAttachment[]
}

const stages = [
  { id: 'requested', label: 'Requested', tone: 'border-sky-200/80 bg-gradient-to-b from-sky-50 to-white' },
  { id: 'sample_collected', label: 'Collected', tone: 'border-amber-200/80 bg-gradient-to-b from-amber-50 to-white' },
  { id: 'processing', label: 'Processing', tone: 'border-violet-200/80 bg-gradient-to-b from-violet-50 to-white' },
  { id: 'resulted', label: 'Resulted', tone: 'border-teal-200/80 bg-gradient-to-b from-teal-50 to-white' },
  { id: 'verified', label: 'Verified', tone: 'border-emerald-200/80 bg-gradient-to-b from-emerald-50 to-white' },
] as const

function itemSummary(items?: LabRequestRow['items']) {
  if (!items?.length) return undefined
  return items
    .map((item) => item.orderableTest?.name ?? item.test?.name ?? item.panel?.name)
    .filter(Boolean)
    .slice(0, 2)
    .join(', ')
}

export function LabWorklist({ initialRequestId }: { initialRequestId?: string | null }) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchItem | null>(null)
  const [activeId, setActiveId] = useState<string | null>(initialRequestId ?? null)
  const [showNewRequest, setShowNewRequest] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fileBusyId, setFileBusyId] = useState<string | null>(null)

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['lab-requests'],
    queryFn: async () => {
      const res = await apiRequest<{ items: LabRequestRow[] } | LabRequestRow[]>('/laboratory/requests')
      return Array.isArray(res) ? res : (res.items ?? [])
    },
    refetchInterval: 20_000,
  })

  useEffect(() => {
    if (initialRequestId) setActiveId(initialRequestId)
  }, [initialRequestId])

  const active = requests.find((r) => r.id === activeId) ?? null

  const { data: activeDetail } = useQuery({
    queryKey: ['lab-request', active?.id],
    queryFn: () => apiRequest<LabRequestRow>(`/laboratory/requests/${active!.id}`),
    enabled: Boolean(active?.id),
  })

  const activeRequest = activeDetail ?? active

  const refreshClinical = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['lab-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['lab-request'] }),
      queryClient.invalidateQueries({ queryKey: ['lab-module-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['critical-results'] }),
      queryClient.invalidateQueries({ queryKey: ['notification-inbox'] }),
    ])
  }

  const collectSample = useMutation({
    mutationFn: (requestId: string) =>
      apiRequest<{
        requestNo: string
        patient: { firstName: string; lastName: string; patientNo: string }
        samples: LabSampleRow[]
      }>(`/laboratory/requests/${requestId}/samples`, {
        method: 'POST',
        body: JSON.stringify({ type: 'blood' }),
      }),
    onSuccess: async (result) => {
      notify(
        'Samples collected',
        `${result.samples.length} sticker${result.samples.length === 1 ? '' : 's'} ready to print.`,
        'success',
      )
      printLabStickers(
        result.samples.map((sample) => ({
          barcode: sample.barcode,
          patientName: `${result.patient.firstName} ${result.patient.lastName}`,
          patientNo: result.patient.patientNo,
          sample: sample.testName || sample.type,
          requestNo: result.requestNo,
        })),
      )
      await refreshClinical()
    },
    onError: (error: Error) => notify('Sample collection failed', error.message, 'critical'),
  })

  const enterResult = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/laboratory/results', {
        method: 'POST',
        body: JSON.stringify({
          requestItemId: form.get('requestItemId'),
          value: form.get('value'),
          unit: form.get('unit') || undefined,
        }),
      })
    },
    onSuccess: async () => {
      notify('Result saved', 'Critical values alert clinicians immediately.', 'success')
      await refreshClinical()
    },
    onError: (error: Error) => notify('Result entry failed', error.message, 'critical'),
  })

  const verifyRequest = useMutation({
    mutationFn: (requestId: string) =>
      apiRequest(`/laboratory/requests/${requestId}/verify`, { method: 'POST' }),
    onSuccess: async () => {
      notify('Results verified', 'Doctor notified in inbox.', 'success')
      await refreshClinical()
      setActiveId(null)
    },
    onError: (error: Error) => notify('Verification failed', error.message, 'critical'),
  })

  const deleteAttachment = useMutation({
    mutationFn: (attachmentId: string) =>
      apiRequest(`/laboratory/attachments/${attachmentId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      notify('Attachment removed', 'PDF report deleted from request.', 'success')
      await refreshClinical()
    },
    onError: (error: Error) => notify('Delete failed', error.message, 'critical'),
  })

  const attachPdf = async (requestId: string, file: File) => {
    setUploading(true)
    try {
      const uploaded = await uploadClinicalFile(file, 'laboratory', requestId)
      await apiRequest(`/laboratory/requests/${requestId}/attachments`, {
        method: 'POST',
        body: JSON.stringify({
          filename: uploaded.filename,
          mimeType: uploaded.mimeType,
          storagePath: uploaded.storagePath,
          title: uploaded.filename,
        }),
      })
      notify('PDF uploaded', 'Report linked to request.', 'success')
      await refreshClinical()
    } catch (error) {
      notify('Upload failed', (error as Error).message, 'critical')
    } finally {
      setUploading(false)
    }
  }

  const byStage = useMemo(() => {
    const map: Record<string, LabRequestRow[]> = {}
    for (const s of stages) map[s.id] = []
    for (const r of requests) {
      if (map[r.status]) map[r.status].push(r)
      else map.requested?.push(r)
    }
    return map
  }, [requests])

  return (
    <div className="space-y-6">
      <LabSection
        title="Specimen workflow board"
        description="Five-column board from order to verified release. Click a request to collect samples, attach a PDF, or verify."
        action={
          <Button type="button" variant="secondary" onClick={() => setShowNewRequest((v) => !v)}>
            <Plus className="h-4 w-4" />
            {showNewRequest ? 'Close order form' : 'New request'}
          </Button>
        }
      >
        {showNewRequest ? (
          <div className="mb-6 rounded-2xl border border-teal-200 bg-teal-50/40 p-5">
            <PatientSearchAutocomplete selected={selectedPatient} onSelect={setSelectedPatient} />
            {selectedPatient ? (
              <div className="mt-4">
                <ClinicalInvestigationOrders
                  compact
                  defaultMode="lab"
                  context={{
                    patientId: selectedPatient.id,
                    patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
                  }}
                  onSuccess={async () => {
                    await queryClient.invalidateQueries({ queryKey: ['lab-requests'] })
                    setShowNewRequest(false)
                  }}
                />
              </div>
            ) : (
              <p className="mt-3 text-sm text-teal-800">Search and select a patient to place a laboratory order.</p>
            )}
          </div>
        ) : null}

        {isLoading ? (
          <div className="lab-kanban-scroll">
            {stages.map((s) => (
              <div key={s.id} className="h-72 animate-skeleton rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="lab-kanban-scroll">
            {stages.map((stage) => (
              <LabKanbanColumn
                key={stage.id}
                label={stage.label}
                count={byStage[stage.id]?.length ?? 0}
                tone={stage.tone}
              >
                {(byStage[stage.id] ?? []).map((req) => (
                  <LabQueueItem
                    key={req.id}
                    active={activeId === req.id}
                    onClick={() => setActiveId(req.id)}
                    name={
                      req.patient ? `${req.patient.firstName} ${req.patient.lastName}` : 'Unknown patient'
                    }
                    patientNo={req.patient?.patientNo ? formatPatientNoShort(req.patient.patientNo) : undefined}
                    status={req.status}
                    priority={req.priority}
                    wait={waitLabel(req.createdAt)}
                    subtitle={itemSummary(req.items)}
                  />
                ))}
                {!byStage[stage.id]?.length ? (
                  <p className="py-8 text-center text-xs text-slate-400">Empty</p>
                ) : null}
              </LabKanbanColumn>
            ))}
          </div>
        )}
      </LabSection>

      {activeRequest ? (
        <LabModal
          wide
          title="Request workspace"
          description="Collect samples, attach instrument PDFs, and release verified results."
          onClose={() => setActiveId(null)}
        >
          <div className="space-y-5">
              <LabPatientStrip
                firstName={activeRequest.patient?.firstName}
                lastName={activeRequest.patient?.lastName}
                patientNo={
                  activeRequest.patient?.patientNo
                    ? formatPatientNoShort(activeRequest.patient.patientNo)
                    : undefined
                }
                status={activeRequest.status}
                priority={activeRequest.priority}
                wait={waitLabel(activeRequest.createdAt)}
              />
              {activeRequest.patient?.id ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="px-3 py-2 text-xs"
                  onClick={() => openPatientFile(activeRequest.patient!.id!)}
                >
                  Open patient file
                </Button>
              ) : null}

              {(activeRequest.items ?? []).length ? (
                <div className="flex flex-wrap gap-2">
                  {activeRequest.items!.map((item) => (
                    <span
                      key={item.id}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {item.orderableTest?.name ?? item.test?.name ?? item.panel?.name ?? 'Test'}
                    </span>
                  ))}
                </div>
              ) : null}
              {(activeRequest.samples ?? []).length ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Sample stickers</p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {activeRequest.samples!.map((sample) => (
                      <li key={sample.id} className="font-mono text-slate-800">
                        {sample.barcode}
                        <span className="ml-2 font-sans text-slate-600">
                          · {sample.testName || sample.type}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {activeRequest.status === 'requested' ? (
                  <Button
                    type="button"
                    onClick={() => collectSample.mutate(activeRequest.id)}
                    loading={collectSample.isPending}
                  >
                    <TestTube className="h-4 w-4" />
                    Collect & print stickers
                  </Button>
                ) : null}
                {(activeRequest.samples ?? []).length ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      printLabStickers(
                        activeRequest.samples!.map((sample) => ({
                          barcode: sample.barcode,
                          patientName: activeRequest.patient
                            ? `${activeRequest.patient.firstName} ${activeRequest.patient.lastName}`
                            : 'Patient',
                          patientNo: activeRequest.patient?.patientNo ?? '—',
                          sample: sample.testName || sample.type,
                          requestNo: activeRequest.requestNo,
                        })),
                      )
                    }
                  >
                    <Printer className="h-4 w-4" />
                    Reprint stickers ({activeRequest.samples!.length})
                  </Button>
                ) : null}
                {['resulted', 'processing', 'sample_collected'].includes(activeRequest.status) ? (
                  <Button
                    type="button"
                    onClick={() => verifyRequest.mutate(activeRequest.id)}
                    loading={verifyRequest.isPending}
                  >
                    Verify & notify doctor
                  </Button>
                ) : null}
              </div>

              <div className="rounded-2xl border-2 border-dashed border-teal-200 bg-gradient-to-br from-teal-50/80 to-white p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-teal-900">
                  <FileUp className="h-4 w-4" />
                  Instrument / external PDF
                </div>
                <p className="mt-1 text-xs text-slate-600">Attach analyzer output or scanned report.</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,image/*"
                  className="mt-3 w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-teal-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) await attachPdf(activeRequest.id, file)
                    e.target.value = ''
                  }}
                />
                {uploading ? <p className="mt-2 text-xs font-medium text-teal-700">Uploading…</p> : null}
              </div>

              {(activeRequest.attachments ?? []).length ? (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Attachments</p>
                  {activeRequest.attachments!.map((file) => (
                    <div
                      key={file.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <span className="text-sm font-medium text-slate-800">{file.title ?? file.filename}</span>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-3 py-2 text-xs"
                          loading={fileBusyId === `${file.id}-view`}
                          onClick={async () => {
                            setFileBusyId(`${file.id}-view`)
                            try {
                              await viewClinicalFile(file.storagePath)
                            } catch (error) {
                              notify('View failed', (error as Error).message, 'critical')
                            } finally {
                              setFileBusyId(null)
                            }
                          }}
                        >
                          View
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-3 py-2 text-xs"
                          loading={fileBusyId === `${file.id}-print`}
                          onClick={async () => {
                            setFileBusyId(`${file.id}-print`)
                            try {
                              await viewClinicalFile(file.storagePath)
                            } finally {
                              setFileBusyId(null)
                            }
                          }}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-3 py-2 text-xs"
                          loading={fileBusyId === file.id}
                          onClick={async () => {
                            setFileBusyId(file.id)
                            try {
                              await downloadClinicalFile(file.storagePath, file.filename)
                            } finally {
                              setFileBusyId(null)
                            }
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-3 py-2 text-xs"
                          loading={deleteAttachment.isPending}
                          onClick={() => deleteAttachment.mutate(file.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {(activeRequest.items ?? []).length ? (
                <form
                  className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    enterResult.mutate(e.currentTarget)
                  }}
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Quick single result</p>
                  <SelectField name="requestItemId" label="Analyte" required>
                    {(activeRequest.items ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.orderableTest?.name ?? item.test?.name ?? item.panel?.name ?? item.id}
                      </option>
                    ))}
                  </SelectField>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field name="value" label="Value" required />
                    <Field name="unit" label="Unit" />
                  </div>
                  <Button type="submit" loading={enterResult.isPending} className="px-3 py-2 text-xs">
                    Save result
                  </Button>
                </form>
              ) : null}
          </div>
        </LabModal>
      ) : null}
    </div>
  )
}
