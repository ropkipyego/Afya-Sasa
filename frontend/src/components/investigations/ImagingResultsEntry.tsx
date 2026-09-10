import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileUp } from 'lucide-react'
import { Button, PageHeader, TextareaField } from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'
import { formDataFromElement } from '../../lib/form-utils'
import { uploadClinicalFile, viewClinicalFile } from '../../lib/clinical-upload'
import { formatPatientNoShort } from '../../lib/patient-utils'
import { LabEmptyState, LabModal, LabQueueItem, LabSection } from './lab-ui'

type RadiologyRequestRow = {
  id: string
  status: string
  priority?: string
  bodyPart: string
  patient?: { firstName: string; lastName: string; patientNo: string }
  modality?: { name: string }
  reports?: { id: string; verifiedAt: string | null }[]
  attachments?: { id: string; filename: string; storagePath: string }[]
}

export function ImagingResultsEntry() {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchItem | null>(null)

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['radiology-requests'],
    queryFn: () => apiRequest<RadiologyRequestRow[]>('/radiology/requests'),
    refetchInterval: 30_000,
    enabled: !selectedPatient?.id,
  })

  const { data: patientRequests = [], isLoading: patientLoading } = useQuery({
    queryKey: ['radiology-patient-requests', selectedPatient?.id],
    queryFn: () =>
      apiRequest<RadiologyRequestRow[]>(`/radiology/patients/${selectedPatient!.id}/requests`),
    enabled: Boolean(selectedPatient?.id),
  })

  const listSource = selectedPatient ? patientRequests : requests
  const listLoading = selectedPatient ? patientLoading : isLoading
  const activeRequests = listSource.filter((r) => !['verified', 'cancelled'].includes(r.status))

  const { data: detail } = useQuery({
    queryKey: ['radiology-request', selectedId],
    queryFn: () => apiRequest<RadiologyRequestRow>(`/radiology/requests/${selectedId!}`),
    enabled: Boolean(selectedId),
  })

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['radiology-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['radiology-request'] }),
      queryClient.invalidateQueries({ queryKey: ['notification-inbox'] }),
    ])
  }

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
      await refresh()
    },
  })

  const verifyRequest = useMutation({
    mutationFn: (requestId: string) =>
      apiRequest(`/radiology/requests/${requestId}/verify`, { method: 'POST' }),
    onSuccess: async () => {
      notify('Report verified', 'Clinicians notified.', 'success')
      await refresh()
      setSelectedId(null)
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
      notify('PDF uploaded', 'Ordering doctor notified.', 'success')
      await refresh()
    } catch (error) {
      notify('Upload failed', (error as Error).message, 'critical')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Enter & upload imaging reports"
        description="Search a patient first for patient-centric entry, or browse all open imaging requests."
      />

      <PatientSearchAutocomplete
        selected={selectedPatient}
        onSelect={(patient) => {
          setSelectedPatient(patient)
          setSelectedId(null)
        }}
      />
      {selectedPatient ? (
        <p className="text-sm text-teal-800">
          Showing imaging for{' '}
          <strong>
            {selectedPatient.firstName} {selectedPatient.lastName}
          </strong>{' '}
          ({selectedPatient.patientNo})
          {' · '}
          <button type="button" className="font-semibold underline" onClick={() => setSelectedPatient(null)}>
            Show all requests
          </button>
        </p>
      ) : null}

      <LabSection
        title={selectedPatient ? 'Patient requests' : 'Open requests'}
        description={`${activeRequests.length} awaiting report — click a card to enter findings`}
      >
        {listLoading ? (
          <div className="h-48 animate-skeleton rounded-2xl" />
        ) : activeRequests.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activeRequests.map((req) => (
              <LabQueueItem
                key={req.id}
                active={selectedId === req.id}
                onClick={() => setSelectedId(req.id)}
                name={
                  req.patient ? `${req.patient.firstName} ${req.patient.lastName}` : 'Unknown patient'
                }
                patientNo={req.patient?.patientNo ? formatPatientNoShort(req.patient.patientNo) : undefined}
                status={req.status}
                priority={req.priority ?? 'routine'}
                subtitle={[req.modality?.name, req.bodyPart].filter(Boolean).join(' · ')}
              />
            ))}
          </div>
        ) : (
          <LabEmptyState title="No open requests" description="The imaging report queue is empty." />
        )}
      </LabSection>

      {selectedId ? (
        <LabModal
          wide
          title="Report entry"
          description={
            detail
              ? `${detail.patient?.firstName ?? ''} ${detail.patient?.lastName ?? ''} — ${detail.modality?.name ?? 'Imaging'}`
              : 'Loading request…'
          }
          onClose={() => setSelectedId(null)}
        >
          {!detail ? (
            <div className="space-y-4">
              <div className="h-16 animate-skeleton rounded-2xl" />
              <div className="h-48 animate-skeleton rounded-2xl" />
            </div>
          ) : (
          <div className="space-y-6">

              <div className="rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/40 p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-teal-900">
                  <FileUp className="h-4 w-4" />
                  Upload radiology report PDF
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  External report PDF — notifies the ordering doctor immediately.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,image/*"
                  className="mt-4 w-full text-sm"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) await attachPdf(detail.id, file)
                    e.target.value = ''
                  }}
                />
                {uploading ? <p className="mt-2 text-xs text-teal-700">Uploading…</p> : null}
              </div>

              {(detail.attachments ?? []).length ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-700">Uploaded reports</p>
                  {detail.attachments!.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                    >
                      <span className="text-sm font-medium">{file.filename}</span>
                      <Button type="button" variant="secondary" onClick={() => viewClinicalFile(file.storagePath)}>
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}

              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  createReport.mutate(e.currentTarget)
                }}
              >
                <input type="hidden" name="requestId" value={detail.id} />
                <TextareaField name="findings" label="Findings" required />
                <TextareaField name="impression" label="Impression" required />
                <TextareaField name="recommendation" label="Recommendation" />
                <Button type="submit" loading={createReport.isPending}>
                  Save text report
                </Button>
              </form>

              {detail.status === 'reported' ? (
                <Button type="button" onClick={() => verifyRequest.mutate(detail.id)} loading={verifyRequest.isPending}>
                  Verify report
                </Button>
              ) : null}
          </div>
          )}
        </LabModal>
      ) : null}
    </div>
  )
}
