import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Inbox } from 'lucide-react'
import clsx from 'clsx'
import { Button } from '../ui'
import { apiRequest } from '../../lib/api'
import { formatPatientNoShort } from '../../lib/patient-utils'
import { LabEmptyState, LabFlagBadge, LabSection } from './lab-ui'

type LabInboxItem = {
  id: string
  value?: string
  unit?: string | null
  flag?: string
  reviewedAt?: string | null
  referenceRange?: string | null
  requestItem?: {
    test?: { name: string } | null
    panel?: { name: string } | null
    orderableTest?: { name: string } | null
    request?: {
      requestNo?: string
      patient?: { firstName: string; lastName: string; patientNo: string }
    }
  }
}

function InboxCard({
  patientName,
  patientNo,
  subtitle,
  resultLine,
  flag,
  reviewed,
  onReview,
  reviewing,
  critical,
}: {
  patientName?: string
  patientNo?: string
  subtitle?: string
  resultLine: string
  flag?: string | null
  reviewed?: boolean
  onReview: () => void
  reviewing?: boolean
  critical?: boolean
}) {
  return (
    <article
      className={clsx(
        'rounded-2xl border p-4 transition hover:shadow-sm',
        critical ? 'border-rose-200 bg-gradient-to-br from-rose-50/80 to-white' : 'border-slate-200 bg-white',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {patientName ? (
            <p className="font-semibold text-slate-900">
              {patientName}
              {patientNo ? <span className="ml-2 text-sm font-normal text-slate-500">{patientNo}</span> : null}
            </p>
          ) : null}
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <LabFlagBadge flag={flag} />
      </div>
      <p className="mt-3 text-lg font-bold tabular-nums text-slate-900">{resultLine || '—'}</p>
      <Button
        type="button"
        variant={reviewed ? 'secondary' : 'primary'}
        className="mt-4 w-full sm:w-auto"
        disabled={Boolean(reviewed)}
        loading={reviewing}
        onClick={onReview}
      >
        {reviewed ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Reviewed
          </>
        ) : (
          'Mark reviewed'
        )}
      </Button>
    </article>
  )
}

function testName(item: LabInboxItem) {
  return (
    item.requestItem?.orderableTest?.name ??
    item.requestItem?.test?.name ??
    item.requestItem?.panel?.name
  )
}

export function ResultsInbox() {
  const queryClient = useQueryClient()
  const { data: labResults = [] } = useQuery({
    queryKey: ['lab-results-inbox'],
    queryFn: () => apiRequest<LabInboxItem[]>('/laboratory/results/inbox'),
    refetchInterval: 20_000,
  })
  const { data: criticalResults = [] } = useQuery({
    queryKey: ['critical-results'],
    queryFn: () => apiRequest<LabInboxItem[]>('/laboratory/results/critical'),
    refetchInterval: 20_000,
  })

  const reviewLab = useMutation({
    mutationFn: (id: string) => apiRequest(`/laboratory/results/${id}/review`, { method: 'POST' }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lab-results-inbox'] }),
        queryClient.invalidateQueries({ queryKey: ['critical-results'] }),
        queryClient.invalidateQueries({ queryKey: ['lab-module-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['doctor-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['consultation-lab-inbox'] }),
      ])
    },
  })

  const pendingLab = labResults.filter((i) => !i.reviewedAt)
  const pendingCritical = criticalResults.filter((i) => !i.reviewedAt)

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
        <p className="text-sm font-semibold text-slate-900">Laboratory results only</p>
        <p className="mt-1 text-xs text-slate-500">
          Verified and critical lab values. Imaging reports stay in Radiology.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <LabSection
          title="Verified lab results"
          description={`${pendingLab.length} awaiting clinician review`}
          icon={Inbox}
        >
          <div className="space-y-3">
            {pendingLab.map((item) => {
              const patient = item.requestItem?.request?.patient
              return (
                <InboxCard
                  key={item.id}
                  patientName={patient ? `${patient.firstName} ${patient.lastName}` : undefined}
                  patientNo={patient?.patientNo ? formatPatientNoShort(patient.patientNo) : undefined}
                  subtitle={[item.requestItem?.request?.requestNo, testName(item)].filter(Boolean).join(' · ')}
                  resultLine={[item.value, item.unit].filter(Boolean).join(' ')}
                  flag={item.flag}
                  reviewed={Boolean(item.reviewedAt)}
                  reviewing={reviewLab.isPending}
                  onReview={() => reviewLab.mutate(item.id)}
                />
              )
            })}
            {!pendingLab.length ? (
              <LabEmptyState title="Inbox clear" description="No verified lab results pending review." icon={Inbox} />
            ) : null}
          </div>
        </LabSection>

        <LabSection
          title="Critical values"
          description={`${pendingCritical.length} require immediate attention`}
          icon={AlertTriangle}
          className={pendingCritical.length ? 'ring-2 ring-rose-200' : undefined}
        >
          <div className="space-y-3">
            {pendingCritical.map((item) => {
              const patient = item.requestItem?.request?.patient
              return (
                <InboxCard
                  key={item.id}
                  critical
                  patientName={patient ? `${patient.firstName} ${patient.lastName}` : undefined}
                  patientNo={patient?.patientNo ? formatPatientNoShort(patient.patientNo) : undefined}
                  subtitle={[item.requestItem?.request?.requestNo, testName(item)].filter(Boolean).join(' · ')}
                  resultLine={[item.value, item.unit].filter(Boolean).join(' ')}
                  flag={item.flag ?? 'CRITICAL'}
                  reviewed={Boolean(item.reviewedAt)}
                  reviewing={reviewLab.isPending}
                  onReview={() => reviewLab.mutate(item.id)}
                />
              )
            })}
            {!pendingCritical.length ? (
              <LabEmptyState
                title="No critical flags"
                description="All critical results have been addressed."
                icon={AlertTriangle}
              />
            ) : null}
          </div>
        </LabSection>
      </div>
    </div>
  )
}
