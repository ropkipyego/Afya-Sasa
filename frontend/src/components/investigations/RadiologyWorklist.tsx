import { useEffect, useMemo, useRef, useState } from 'react'
import { formDataFromElement } from '../../lib/form-utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileUp, Download, Printer } from 'lucide-react'
import { Button, Card, PageHeader, TextareaField } from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { RadiologyRequestTemplateForm } from './RadiologyRequestTemplateForm'
import { apiRequest } from '../../lib/api'
import { uploadClinicalFile, downloadClinicalFile } from '../../lib/clinical-upload'
import { notify } from '../../lib/notify'
import { useClinicalCatalog } from '../../hooks/useClinicalCatalog'
import { normalizeClinicalCatalog } from '../../lib/clinical-catalog'
import { resolveHospitalBranding } from '../../lib/hospital-configuration'
import { parseStoredRequestFormData } from '../../lib/jalaram-imaging-request'
import { printJalaramImagingRequest } from '../../lib/print-radiology-request'
import { formatPatientNoShort } from '../../lib/patient-utils'
import { LabKanbanColumn, LabModal, LabQueueItem } from './lab-ui'

type RadiologyRequestRow = {
  id: string
  status: string
  priority: string
  bodyPart: string
  clinicalIndication: string
  createdAt: string
  requestNo?: string
  requestFormData?: Record<string, unknown> | null
  referringClinician?: string | null
  patient?: { firstName: string; lastName: string; patientNo: string; dateOfBirth?: string; gender?: string }
  modality?: { name: string }
  reports?: { id: string; verifiedAt: string | null; findings: string; impression: string }[]
  attachments?: { id: string; filename: string; mimeType: string; storagePath: string }[]
}

const stages = [
  { id: 'requested', label: 'Requested', tone: 'border-sky-200 bg-sky-50' },
  { id: 'scheduled', label: 'Scheduled', tone: 'border-indigo-200 bg-indigo-50' },
  { id: 'in_progress', label: 'In progress', tone: 'border-violet-200 bg-violet-50' },
  { id: 'reported', label: 'Reported', tone: 'border-teal-200 bg-teal-50' },
  { id: 'verified', label: 'Verified', tone: 'border-emerald-200 bg-emerald-50' },
] as const

function waitLabel(createdAt: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60_000))
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export function RadiologyWorklist({ initialRequestId }: { initialRequestId?: string | null }) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const { data: rawCatalog } = useClinicalCatalog()
  const catalog = normalizeClinicalCatalog(rawCatalog)
  const brand = resolveHospitalBranding(catalog)
  const profile = catalog.hospitalProfile ?? {}
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchItem | null>(null)
  const [activeId, setActiveId] = useState<string | null>(initialRequestId ?? null)
  const [showNewRequest, setShowNewRequest] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['radiology-requests'],
    queryFn: () => apiRequest<RadiologyRequestRow[]>('/radiology/requests'),
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (initialRequestId) setActiveId(initialRequestId)
  }, [initialRequestId])

  const active = requests.find((r) => r.id === activeId) ?? null

  const { data: activeDetail } = useQuery({
    queryKey: ['radiology-request', active?.id],
    queryFn: () => apiRequest<RadiologyRequestRow>(`/radiology/requests/${active!.id}`),
    enabled: Boolean(active?.id),
  })

  const activeRequest = activeDetail ?? active
  const latestReport = activeRequest?.reports?.[0] ?? null

  const printActiveRequest = () => {
    if (!activeRequest) return
    const parsed = parseStoredRequestFormData(activeRequest.requestFormData)
    if (!parsed) {
      notify('Print unavailable', 'This request has no structured Jalaram form data.', 'warning')
      return
    }
    printJalaramImagingRequest({
      requestNo: activeRequest.requestNo ?? null,
      requestDate: parsed.requestDate ?? new Date().toISOString().slice(0, 10),
      patientName:
        activeRequest.patient
          ? `${activeRequest.patient.firstName} ${activeRequest.patient.lastName}`
          : (parsed.patientName ?? 'Patient'),
      patientNo: activeRequest.patient?.patientNo ?? parsed.patientNo ?? null,
      age: parsed.age ?? '—',
      gender: parsed.gender ?? '—',
      lmp: parsed.lmp ?? null,
      examTypes: parsed.examTypes ?? [],
      requestedInvestigation: parsed.requestedInvestigation ?? null,
      urgencyUrgent: parsed.urgencyUrgent ?? false,
      generalInformation: parsed.generalInformation ?? {
        contrastAllergy: false,
        kidneyLiverDisease: false,
        vitallyUnstable: false,
        requiresOxygen: false,
      },
      diagnosis: parsed.diagnosis ?? '',
      briefHistory: parsed.briefHistory ?? '',
      doctorName: parsed.doctorName ?? activeRequest.referringClinician ?? '',
      facilityName: parsed.facilityName ?? null,
      doctorPhone: parsed.doctorPhone ?? null,
      branding: {
        facilityName: profile.facilityName ?? 'Hospital',
        tagline: profile.tagline ?? 'Caring Hearts Healing Hands',
        primaryColor: brand.primaryColor ?? '#1e4d8c',
        accentColor: brand.accentColor ?? '#c41e3a',
        logoUrl: profile.logoUrl,
        contactPhone: profile.contactPhone ?? undefined,
        contactEmail: profile.contactEmail ?? undefined,
        address: profile.physicalAddress ?? profile.address ?? undefined,
        website: profile.website ?? undefined,
      },
    })
  }

  const refreshClinical = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['radiology-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['radiology-request'] }),
      queryClient.invalidateQueries({ queryKey: ['notification-inbox'] }),
      queryClient.invalidateQueries({ queryKey: ['notification-summary'] }),
    ])
  }

  const byStage = useMemo(() => {
    const map: Record<string, RadiologyRequestRow[]> = {}
    for (const s of stages) map[s.id] = []
    for (const r of requests) {
      if (map[r.status]) map[r.status].push(r)
      else map.requested?.push(r)
    }
    return map
  }, [requests])

  const createReport = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest(`/radiology/requests/${form.get('requestId')}/reports`, {
        method: 'POST',
        body: JSON.stringify({
          findings: form.get('findings'),
          impression: form.get('impression'),
          recommendation: form.get('recommendation') || undefined,
        }),
      })
    },
    onSuccess: async () => {
      notify('Report saved', 'Ordering clinician notified.', 'success')
      await refreshClinical()
    },
  })

  const verifyRequest = useMutation({
    mutationFn: (requestId: string) =>
      apiRequest(`/radiology/requests/${requestId}/verify`, { method: 'POST' }),
    onSuccess: async () => {
      notify('Report verified', 'Clinicians notified in the inbox.', 'success')
      await refreshClinical()
      setActiveId(null)
    },
  })

  const attachPdf = async (requestId: string, file: File) => {
    setUploading(true)
    try {
      const uploaded = await uploadClinicalFile(file, 'radiology', requestId)
      await apiRequest(`/radiology/requests/${requestId}/attachments`, {
        method: 'POST',
        body: JSON.stringify({
          filename: uploaded.filename,
          mimeType: uploaded.mimeType,
          storagePath: uploaded.storagePath,
        }),
      })
      notify('PDF attached', 'Report PDF linked to request.', 'success')
      await refreshClinical()
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="workspace-shell animate-fade-in">
      <PageHeader
        title="Imaging workflow board"
        description="Five-column board from request to verified report. Click a study to report or attach a PDF."
        actions={
          <Button type="button" variant="secondary" onClick={() => setShowNewRequest((v) => !v)}>
            New request
          </Button>
        }
      />

      {showNewRequest ? (
        <Card className="p-5 md:p-8">
          <PageHeader
            title="New imaging request"
            description="Digital Jalaram imaging request form — same fields as your paper form. Attach a signed copy after submit if needed."
          />
          <div className="mt-6 space-y-4">
            <PatientSearchAutocomplete selected={selectedPatient} onSelect={setSelectedPatient} />
            {selectedPatient ? (
              <RadiologyRequestTemplateForm
                context={{
                  patientId: selectedPatient.id,
                  patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
                  patientNo: selectedPatient.patientNo,
                  dateOfBirth: selectedPatient.dateOfBirth,
                  gender: selectedPatient.gender,
                  patientPhone: selectedPatient.primaryPhone,
                }}
                onSuccess={async () => {
                  await queryClient.invalidateQueries({ queryKey: ['radiology-requests'] })
                  setShowNewRequest(false)
                  setSelectedPatient(null)
                }}
              />
            ) : null}
          </div>
        </Card>
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
                    req.patient
                      ? `${req.patient.firstName} ${req.patient.lastName}`
                      : 'Unknown patient'
                  }
                  patientNo={req.patient?.patientNo ? formatPatientNoShort(req.patient.patientNo) : undefined}
                  status={req.status}
                  priority={req.priority}
                  wait={waitLabel(req.createdAt)}
                  subtitle={[req.modality?.name, req.bodyPart].filter(Boolean).join(' · ')}
                />
              ))}
              {!byStage[stage.id]?.length ? (
                <p className="py-8 text-center text-xs text-slate-400">Empty</p>
              ) : null}
            </LabKanbanColumn>
          ))}
        </div>
      )}

      {activeRequest ? (
        <LabModal
          wide
          title="Report workspace"
          description={`${activeRequest.patient?.firstName ?? ''} ${activeRequest.patient?.lastName ?? ''} — ${activeRequest.modality?.name ?? 'Imaging'}`}
          onClose={() => setActiveId(null)}
        >
          {activeRequest.requestFormData ? (
            <div className="mb-5">
              <Button type="button" variant="secondary" onClick={printActiveRequest}>
                <Printer className="h-4 w-4" />
                Print request form
              </Button>
            </div>
          ) : null}
          {activeRequest.status === 'reported' && latestReport && !latestReport.verifiedAt ? (
            <div className="mt-6">
              <Button
                type="button"
                onClick={() => verifyRequest.mutate(activeRequest.id)}
                loading={verifyRequest.isPending}
              >
                Verify report
              </Button>
            </div>
          ) : null}
          {latestReport?.verifiedAt ? (
            <p className="mt-6 text-sm font-medium text-emerald-700">Report verified — clinicians notified.</p>
          ) : null}
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              createReport.mutate(e.currentTarget)
            }}
          >
            <input type="hidden" name="requestId" value={activeRequest.id} />
            <TextareaField name="findings" label="Findings" required />
            <TextareaField name="impression" label="Impression" required />
            <TextareaField name="recommendation" label="Recommendation" />
            <Button type="submit" loading={createReport.isPending}>
              Save text report
            </Button>
          </form>

          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <FileUp className="h-4 w-4 text-teal-600" />
              Attach report PDF
            </div>
            <p className="mt-1 text-xs text-slate-500">Upload external radiology report PDF — no PACS required.</p>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              className="mt-4 w-full text-sm"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (file) await attachPdf(activeRequest.id, file)
                e.target.value = ''
              }}
            />
            {uploading ? <p className="mt-2 text-xs text-teal-700">Uploading…</p> : null}
          </div>

          {(activeRequest.attachments ?? []).length ? (
            <div className="mt-6 space-y-2">
              <p className="text-sm font-semibold text-slate-700">Attached files</p>
              {activeRequest.attachments!.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <span className="text-sm font-medium text-slate-800">{file.filename}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    loading={downloadingId === file.id}
                    onClick={async () => {
                      setDownloadingId(file.id)
                      try {
                        await downloadClinicalFile(file.storagePath, file.filename)
                      } catch (error) {
                        notify('Download failed', (error as Error).message, 'critical')
                      } finally {
                        setDownloadingId(null)
                      }
                    }}
                  >
                    <Download className="mr-1.5 h-4 w-4" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </LabModal>
      ) : null}
    </div>
  )
}
