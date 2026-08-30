import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileUp, FlaskConical } from 'lucide-react'
import clsx from 'clsx'
import { Button, Card, Field, PageHeader, SelectField } from '../ui'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'
import { formDataFromElement } from '../../lib/form-utils'
import { uploadClinicalFile, viewClinicalFile } from '../../lib/clinical-upload'

type LabRequestRow = {
  id: string
  status: string
  createdAt: string
  patient?: { firstName: string; lastName: string; patientNo: string }
  items?: { id: string; test?: { name: string }; panel?: { name: string } }[]
  attachments?: { id: string; filename: string; title?: string | null; storagePath: string }[]
}

export function LabResultsEntry() {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['lab-requests'],
    queryFn: async () => {
      const res = await apiRequest<{ items: LabRequestRow[] } | LabRequestRow[]>('/laboratory/requests')
      return Array.isArray(res) ? res : (res.items ?? [])
    },
    refetchInterval: 20_000,
  })

  const activeRequests = requests.filter((r) => !['verified', 'cancelled'].includes(r.status))

  const { data: detail } = useQuery({
    queryKey: ['lab-request', selectedId],
    queryFn: () => apiRequest<LabRequestRow>(`/laboratory/requests/${selectedId!}`),
    enabled: Boolean(selectedId),
  })

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['lab-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['lab-request'] }),
      queryClient.invalidateQueries({ queryKey: ['notification-inbox'] }),
    ])
  }

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
      notify('Result saved', 'Ordering clinician will be notified on verification.', 'success')
      await refresh()
    },
    onError: (e: Error) => notify('Result entry failed', e.message, 'critical'),
  })

  const verifyRequest = useMutation({
    mutationFn: (requestId: string) =>
      apiRequest(`/laboratory/requests/${requestId}/verify`, { method: 'POST' }),
    onSuccess: async () => {
      notify('Verified', 'Doctor notified in inbox.', 'success')
      await refresh()
    },
    onError: (e: Error) => notify('Verification failed', e.message, 'critical'),
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
        title="Enter & upload lab results"
        description="Select an open request, enter structured values, or upload a PDF report. Doctors are notified when a PDF is attached and again when results are verified."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="p-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Open requests</h3>
          {isLoading ? (
            <div className="mt-4 h-48 animate-skeleton rounded-xl" />
          ) : (
            <ul className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto">
              {activeRequests.map((req) => (
                <li key={req.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(req.id)}
                    className={clsx(
                      'w-full rounded-xl border p-4 text-left text-sm transition',
                      selectedId === req.id
                        ? 'border-teal-400 bg-teal-50 ring-2 ring-teal-100'
                        : 'border-slate-200 hover:border-teal-200',
                    )}
                  >
                    <p className="font-semibold text-slate-900">
                      {req.patient ? `${req.patient.firstName} ${req.patient.lastName}` : 'Unknown'}
                    </p>
                    <p className="text-xs text-slate-500">{req.patient?.patientNo}</p>
                    <p className="mt-2 text-xs font-bold uppercase text-teal-700">
                      {req.status.replaceAll('_', ' ')}
                      {(req.attachments?.length ?? 0) > 0 ? ' · PDF attached' : ''}
                    </p>
                  </button>
                </li>
              ))}
              {!activeRequests.length ? (
                <p className="py-8 text-center text-sm text-slate-500">No open lab requests.</p>
              ) : null}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          {!selectedId || !detail ? (
            <div className="flex min-h-[20rem] flex-col items-center justify-center text-center text-slate-500">
              <FlaskConical className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm">Select a request to enter results or upload a PDF</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {detail.patient?.firstName} {detail.patient?.lastName}
                </h3>
                <p className="text-sm capitalize text-slate-500">{detail.status.replaceAll('_', ' ')}</p>
              </div>

              <div className="rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/40 p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-teal-900">
                  <FileUp className="h-4 w-4" />
                  Upload lab report PDF
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  External or instrument PDF — notifies the ordering doctor immediately.
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
                      <span className="text-sm font-medium">{file.title ?? file.filename}</span>
                      <Button type="button" variant="secondary" onClick={() => viewClinicalFile(file.storagePath)}>
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}

              {(detail.items ?? []).length ? (
                <form
                  className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  onSubmit={(e) => {
                    e.preventDefault()
                    enterResult.mutate(e.currentTarget)
                  }}
                >
                  <p className="text-sm font-bold text-slate-800">Structured result values</p>
                  <SelectField name="requestItemId" label="Test" required>
                    {(detail.items ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.test?.name ?? item.panel?.name ?? item.id}
                      </option>
                    ))}
                  </SelectField>
                  <Field name="value" label="Value" required />
                  <Field name="unit" label="Unit" />
                  <Button type="submit" loading={enterResult.isPending}>
                    Save result
                  </Button>
                </form>
              ) : null}

              <Button
                type="button"
                onClick={() => verifyRequest.mutate(detail.id)}
                loading={verifyRequest.isPending}
              >
                Verify & notify doctor
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
