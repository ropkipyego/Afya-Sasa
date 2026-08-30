import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '../../lib/api'

type LabInboxItem = {
  id: string
  value?: string
  flag?: string
  reviewedAt?: string | null
  requestItem?: {
    test?: { name: string } | null
    panel?: { name: string } | null
    request?: {
      requestNo?: string
      patient?: { firstName: string; lastName: string; patientNo: string }
    }
  }
}

type RadiologyInboxItem = {
  id: string
  impression?: string
  reviewedAt?: string | null
  request?: {
    requestNo?: string
    patient?: { firstName: string; lastName: string; patientNo: string }
    modality?: { name: string }
  }
}

type InboxItem = LabInboxItem | RadiologyInboxItem

function ReviewList({
  title,
  items,
  kind,
  onReview,
}: {
  title: string
  items: InboxItem[]
  kind: 'lab' | 'radiology'
  onReview: (id: string) => void
}) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <h3 className="text-xl font-bold">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const labItem = kind === 'lab' ? (item as LabInboxItem) : null
          const radItem = kind === 'radiology' ? (item as RadiologyInboxItem) : null
          const patient = labItem?.requestItem?.request?.patient ?? radItem?.request?.patient
          const requestNo = labItem?.requestItem?.request?.requestNo ?? radItem?.request?.requestNo
          const testName =
            labItem?.requestItem?.test?.name ??
            labItem?.requestItem?.panel?.name ??
            radItem?.request?.modality?.name

          return (
            <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
              {patient ? (
                <p className="font-semibold text-slate-900">
                  {patient.firstName} {patient.lastName}
                  <span className="ml-2 text-sm font-normal text-slate-500">{patient.patientNo}</span>
                </p>
              ) : null}
              <p className="text-xs text-slate-500">
                {[requestNo, testName].filter(Boolean).join(' · ') || 'Clinical result'}
              </p>
              <p className="mt-1 font-semibold">
                {radItem?.impression ?? `${labItem?.value ?? ''} ${labItem?.flag ?? ''}`.trim()}
              </p>
              <button
                type="button"
                className="mt-3 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-300"
                disabled={Boolean(item.reviewedAt)}
                onClick={() => onReview(item.id)}
              >
                {item.reviewedAt ? 'Reviewed' : 'Mark reviewed'}
              </button>
            </div>
          )
        })}
        {!items.length ? <p className="text-sm text-slate-500">No items.</p> : null}
      </div>
    </div>
  )
}

export function ResultsInbox() {
  const queryClient = useQueryClient()
  const { data: labResults = [] } = useQuery({
    queryKey: ['lab-results-inbox'],
    queryFn: () => apiRequest<LabInboxItem[]>('/laboratory/results/inbox'),
  })
  const { data: criticalResults = [] } = useQuery({
    queryKey: ['critical-results'],
    queryFn: () => apiRequest<LabInboxItem[]>('/laboratory/results/critical'),
  })
  const { data: radiologyReports = [] } = useQuery({
    queryKey: ['radiology-reports-inbox'],
    queryFn: () => apiRequest<RadiologyInboxItem[]>('/radiology/reports/inbox'),
  })
  const reviewLab = useMutation({
    mutationFn: (id: string) => apiRequest(`/laboratory/results/${id}/review`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lab-results-inbox'] })
      await queryClient.invalidateQueries({ queryKey: ['critical-results'] })
    },
  })
  const reviewRadiology = useMutation({
    mutationFn: (id: string) => apiRequest(`/radiology/reports/${id}/review`, { method: 'POST' }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['radiology-reports-inbox'] }),
  })

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <ReviewList
        title="Verified lab results"
        items={labResults.filter((i) => !i.reviewedAt)}
        kind="lab"
        onReview={reviewLab.mutate}
      />
      <ReviewList
        title="Critical lab results"
        items={criticalResults.filter((i) => !i.reviewedAt)}
        kind="lab"
        onReview={reviewLab.mutate}
      />
      <ReviewList
        title="Radiology reports"
        items={radiologyReports.filter((i) => !i.reviewedAt)}
        kind="radiology"
        onReview={reviewRadiology.mutate}
      />
    </div>
  )
}
