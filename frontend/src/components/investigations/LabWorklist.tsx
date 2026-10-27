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
import { useAuthStore } from '../../lib/auth-store'
import { downloadClinicalFile, uploadClinicalFile, viewClinicalFile } from '../../lib/clinical-upload'
import {
  LabKanbanColumn,
  LabModal,
  LabPatientStrip,
  LabQueueItem,
  LabSection,
  waitLabel,
} from './lab-ui'
import { formatReferringDetails } from '../../lib/referring-details'
import { LAB_WORK_AREAS, labWorkArea, labWorkAreaNextAction } from '../../lib/lab-work-areas'

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
  condition?: string | null
  receivedAt?: string | null
  rejectionReason?: string | null
}

type LabRequestRow = {
  id: string
  status: string
  priority: string
  createdAt: string
  requestNo?: string
  patient?: { id?: string; firstName: string; lastName: string; patientNo: string }
  encounter?: {
    referralReason?: string | null
    referralSource?: string | null
  } | null
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
  const canCancelRequest = useAuthStore((state) =>
    Boolean(state.user?.permissions.includes('lab_requests:cancel')),
  )
  const canVerifyResults = useAuthStore((state) =>
    Boolean(state.user?.permissions.includes('lab_results:verify')),
  )
  const canCollectSamples = useAuthStore((state) =>
    Boolean(state.user?.permissions.includes('lab_samples:collect')),
  )
  const canReceiveSamples = useAuthStore((state) =>
    Boolean(state.user?.permissions.includes('lab_samples:receive')),
  )
  const canEnterResults = useAuthStore((state) =>
    Boolean(state.user?.permissions.includes('lab_results:enter')),
  )
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchItem | null>(null)
  const [activeId, setActiveId] = useState<string | null>(initialRequestId ?? null)
  const [specimenBarcode, setSpecimenBarcode] = useState('')
  const [showNewRequest, setShowNewRequest] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fileBusyId, setFileBusyId] = useState<string | null>(null)
  const [receiveCondition, setReceiveCondition] = useState('adequate')
  const [rejectionReason, setRejectionReason] = useState('')
  const [cancelReason, setCancelReason] = useState('')

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

  const receiveSample = useMutation({
    mutationFn: (sampleId: string) =>
      apiRequest(`/laboratory/samples/${sampleId}/receive`, {
        method: 'POST',
        body: JSON.stringify({
          condition: receiveCondition,
          rejectionReason: receiveCondition === 'adequate' ? undefined : rejectionReason,
        }),
      }),
    onSuccess: async () => {
      notify(
        receiveCondition === 'adequate' ? 'Specimen received' : 'Specimen rejected',
        receiveCondition === 'adequate'
          ? 'Condition recorded. Processing may continue.'
          : 'Rejection reason stored. Recollect if ordered.',
        receiveCondition === 'adequate' ? 'success' : 'warning',
      )
      await refreshClinical()
    },
    onError: (error: Error) => notify('Specimen receipt failed', error.message, 'critical'),
  })

  const cancelRequest = useMutation({
    mutationFn: (requestId: string) =>
      apiRequest(`/laboratory/requests/${requestId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason }),
      }),
    onSuccess: async () => {
      notify('Request cancelled', 'Cancellation reason recorded.', 'success')
      setCancelReason('')
      await refreshClinical()
      setActiveId(null)
    },
    onError: (error: Error) => notify('Cancellation failed', error.message, 'critical'),
  })

  const printStructuredReport = async (requestId: string) => {
    try {
      const report = await apiRequest<{ html: string; requestNo: string }>(
        `/laboratory/requests/${requestId}/report`,
      )
      const frame = window.open('', '_blank', 'noopener,noreferrer')
      if (!frame) {
        notify('Print blocked', 'Allow pop-ups to print the laboratory report.', 'warning')
        return
      }
      frame.document.write(report.html)
      frame.document.close()
      frame.focus()
      frame.print()
    } catch (error) {
      notify('Report unavailable', error instanceof Error ? error.message : 'Could not load report', 'critical')
    }
  }

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

  const scanSpecimen = async () => {
    if (!specimenBarcode.trim()) return
    try {
      const scan = await apiRequest<{
        requestId: string | null
        patientName: string | null
        identity: string
      }>('/laboratory/samples/scan', {
        method: 'POST',
        body: JSON.stringify({
          barcode: specimenBarcode.trim(),
          expectedRequestId: activeId || undefined,
          expectedPatientId: active?.patient?.id || undefined,
        }),
      })
      if (!activeId && scan.requestId) setActiveId(scan.requestId)
      notify('Specimen scanned', scan.patientName || scan.identity, 'success')
      setSpecimenBarcode('')
      await queryClient.invalidateQueries({ queryKey: ['lab-requests'] })
    } catch (error) {
      notify(
        'Specimen not accepted',
        error instanceof Error ? error.message : 'Unknown barcode',
        'warning',
      )
    }
  }

  const byArea = useMemo(() => {
    const map: Record<string, LabRequestRow[]> = {}
    for (const area of LAB_WORK_AREAS) map[area.id] = []
    for (const request of requests) {
      const area = labWorkArea(request.status)
      if (map[area]) map[area].push(request)
    }
    return map
  }, [requests])

  return (
    <div className="space-y-6">
      <LabSection
        title="Formal laboratory requests"
        description="These are ordered tests, not reception check-ins. Check-ins sit in the arrivals list above until a request is created. A PDF is not a substitute for structured results."
        action={
          <Button type="button" variant="secondary" onClick={() => setShowNewRequest((v) => !v)}>
            <Plus className="h-4 w-4" />
            {showNewRequest ? 'Close order form' : 'New request'}
          </Button>
        }
      >
        <label className="mb-4 block max-w-md text-sm">
          <span className="font-medium text-slate-700">Scan specimen barcode</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={specimenBarcode}
            onChange={(event) => setSpecimenBarcode(event.target.value)}
            onKeyDown={async (event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              await scanSpecimen()
            }}
            placeholder="Scan label — identifies the specimen, not the patient"
          />
        </label>
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
            {LAB_WORK_AREAS.map((area) => (
              <div key={area.id} className="h-72 animate-skeleton rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="lab-kanban-scroll">
            {LAB_WORK_AREAS.map((area) => (
              <LabKanbanColumn
                key={area.id}
                label={area.label}
                count={byArea[area.id]?.length ?? 0}
                tone={area.tone}
              >
                {(byArea[area.id] ?? []).map((req) => (
                  <LabQueueItem
                    key={req.id}
                    active={activeId === req.id}
                    onClick={() => setActiveId(req.id)}
                    name={
                      req.patient ? `${req.patient.firstName} ${req.patient.lastName}` : 'Unknown patient'
                    }
                    patientNo={
                      req.requestNo
                        ? `${req.requestNo}${req.patient?.patientNo ? ` · ${formatPatientNoShort(req.patient.patientNo)}` : ''}`
                        : req.patient?.patientNo
                          ? formatPatientNoShort(req.patient.patientNo)
                          : undefined
                    }
                    status={req.status}
                    priority={req.priority}
                    wait={waitLabel(req.createdAt)}
                    subtitle={[
                      itemSummary(req.items),
                      labWorkAreaNextAction(req.status),
                      formatReferringDetails(req.encounter?.referralReason) || req.encounter?.referralSource,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                ))}
                {!byArea[area.id]?.length ? (
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
          description="Collect, receive or reject specimens, enter results, then verify. Identity stays locked to this request while it is open."
          onClose={() => setActiveId(null)}
        >
          <div className="space-y-5">
              <label className="block max-w-md text-sm">
                <span className="font-medium text-slate-700">Confirm specimen barcode</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={specimenBarcode}
                  onChange={(event) => setSpecimenBarcode(event.target.value)}
                  onKeyDown={async (event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    await scanSpecimen()
                  }}
                  placeholder="Scan label — identifies the specimen, not the patient"
                />
              </label>
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
                          {sample.condition ? ` · ${sample.condition}` : ' · not received'}
                          {sample.rejectionReason ? ` · ${sample.rejectionReason}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {activeRequest.status === 'requested' ? (
                  canCollectSamples ? (
                    <Button
                      type="button"
                      onClick={() => collectSample.mutate(activeRequest.id)}
                      loading={collectSample.isPending}
                    >
                      <TestTube className="h-4 w-4" />
                      Collect & print stickers
                    </Button>
                  ) : (
                    <p className="text-sm text-slate-600">Specimen collection needs lab_samples:collect.</p>
                  )
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
                {['resulted', 'processing'].includes(activeRequest.status) ? (
                  canVerifyResults ? (
                    <Button
                      type="button"
                      onClick={() => verifyRequest.mutate(activeRequest.id)}
                      loading={verifyRequest.isPending}
                    >
                      Verify & notify doctor
                    </Button>
                  ) : (
                    <p className="text-sm text-slate-600">
                      Verification needs lab_results:verify. Unverified results are not released to the clinician inbox.
                    </p>
                  )
                ) : null}
                {activeRequest.status === 'verified' ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => printStructuredReport(activeRequest.id)}
                  >
                    <Printer className="h-4 w-4" />
                    Print structured report
                  </Button>
                ) : null}
              </div>

              {activeRequest.status === 'sample_collected' && (activeRequest.samples ?? []).length ? (
                <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-violet-900">
                    Receive or reject specimen
                  </p>
                  <p className="text-xs text-slate-600">
                    Adequacy is not assumed. Record the observed condition before receipt.
                  </p>
                  <SelectField
                    name="condition"
                    label="Condition"
                    value={receiveCondition}
                    onChange={(event) => setReceiveCondition(event.target.value)}
                  >
                    <option value="adequate">Adequate</option>
                    <option value="haemolysed">Haemolysed</option>
                    <option value="clotted">Clotted</option>
                    <option value="insufficient">Insufficient</option>
                    <option value="contaminated">Contaminated</option>
                  </SelectField>
                  {receiveCondition !== 'adequate' ? (
                    <Field
                      name="rejectionReason"
                      label="Rejection reason"
                      value={rejectionReason}
                      onChange={(event) => setRejectionReason(event.target.value)}
                    />
                  ) : null}
                  {canReceiveSamples ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => receiveSample.mutate(activeRequest.samples![0].id)}
                      loading={receiveSample.isPending}
                    >
                      Record receipt
                    </Button>
                  ) : (
                    <p className="text-sm text-slate-600">Specimen receipt needs lab_samples:receive.</p>
                  )}
                </div>
              ) : null}

              {canCancelRequest && !['verified', 'cancelled'].includes(activeRequest.status) ? (
                <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Cancel request</p>
                  <Field
                    name="cancelReason"
                    label="Reason"
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!cancelReason.trim()}
                    onClick={() => cancelRequest.mutate(activeRequest.id)}
                    loading={cancelRequest.isPending}
                  >
                    Cancel with reason
                  </Button>
                </div>
              ) : null}

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
                  <Button
                    type="submit"
                    loading={enterResult.isPending}
                    disabled={!canEnterResults}
                    className="px-3 py-2 text-xs"
                  >
                    Save result
                  </Button>
                  {!canEnterResults ? (
                    <p className="text-xs text-slate-500">Result entry needs lab_results:enter.</p>
                  ) : null}
                </form>
              ) : null}
          </div>
        </LabModal>
      ) : null}
    </div>
  )
}
