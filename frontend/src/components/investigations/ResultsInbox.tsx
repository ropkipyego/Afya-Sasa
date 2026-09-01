import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Inbox, ScanLine } from 'lucide-react'
import clsx from 'clsx'
import { Button } from '../ui'
import { apiRequest } from '../../lib/api'
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
        <div>
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
  const { data: radiologyReports = [] } = useQuery({
    queryKey: ['radiology-reports-inbox'],
    queryFn: () => apiRequest<RadiologyInboxItem[]>('/radiology/reports/inbox'),
    refetchInterval: 20_000,
  })

  const reviewLab = useMutation({
    mutationFn: (id: string) => apiRequest(`/laboratory/results/${id}/review`, { method: 'POST' }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lab-results-inbox'] }),
        queryClient.invalidateQueries({ queryKey: ['critical-results'] }),
        queryClient.invalidateQueries({ queryKey: ['lab-module-summary'] }),
      ])
    },
  })

  const reviewRadiology = useMutation({
    mutationFn: (id: string) => apiRequest(`/radiology/reports/${id}/review`, { method: 'POST' }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['radiology-reports-inbox'] }),
  })

  const pendingLab = labResults.filter((i) => !i.reviewedAt)
  const pendingCritical = criticalResults.filter((i) => !i.reviewedAt)
  const pendingRad = radiologyReports.filter((i) => !i.reviewedAt)

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <LabSection
        title="Verified lab results"
        description={`${pendingLab.length} awaiting clinician review`}
        icon={Inbox}
      >
        <div className="space-y-3">
          {pendingLab.map((item) => {
            const patient = item.requestItem?.request?.patient
            const testName =
              item.requestItem?.orderableTest?.name ??
              item.requestItem?.test?.name ??
              item.requestItem?.panel?.name
            return (
              <InboxCard
                key={item.id}
                patientName={patient ? `${patient.firstName} ${patient.lastName}` : undefined}
                patientNo={patient?.patientNo}
                subtitle={[item.requestItem?.request?.requestNo, testName].filter(Boolean).join(' · ')}
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
            const testName =
              item.requestItem?.orderableTest?.name ??
              item.requestItem?.test?.name ??
              item.requestItem?.panel?.name
            return (
              <InboxCard
                key={item.id}
                critical
                patientName={patient ? `${patient.firstName} ${patient.lastName}` : undefined}
                patientNo={patient?.patientNo}
                subtitle={[item.requestItem?.request?.requestNo, testName].filter(Boolean).join(' · ')}
                resultLine={[item.value, item.unit].filter(Boolean).join(' ')}
                flag={item.flag ?? 'CRITICAL'}
                reviewed={Boolean(item.reviewedAt)}
                reviewing={reviewLab.isPending}
                onReview={() => reviewLab.mutate(item.id)}
              />
            )
          })}
          {!pendingCritical.length ? (
            <LabEmptyState title="No critical flags" description="All critical results have been addressed." icon={AlertTriangle} />
          ) : null}
        </div>
      </LabSection>

      <LabSection title="Radiology reports" description={`${pendingRad.length} imaging reports`} icon={ScanLine}>
        <div className="space-y-3">
          {pendingRad.map((item) => {
            const patient = item.request?.patient
            return (
              <InboxCard
                key={item.id}
                patientName={patient ? `${patient.firstName} ${patient.lastName}` : undefined}
                patientNo={patient?.patientNo}
                subtitle={[item.request?.requestNo, item.request?.modality?.name].filter(Boolean).join(' · ')}
                resultLine={item.impression ?? 'Report ready'}
                reviewed={Boolean(item.reviewedAt)}
                reviewing={reviewRadiology.isPending}
                onReview={() => reviewRadiology.mutate(item.id)}
              />
            )
          })}
          {!pendingRad.length ? (
            <LabEmptyState title="No imaging reports" description="Radiology inbox is empty." icon={ScanLine} />
          ) : null}
        </div>
      </LabSection>
    </div>
  )
}
