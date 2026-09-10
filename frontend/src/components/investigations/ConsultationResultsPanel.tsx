import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, FlaskConical, ScanLine } from 'lucide-react'
import clsx from 'clsx'
import { Alert, Button, Card, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'
import { LabFlagBadge, LabPriorityChip, LabStatusChip } from './lab-ui'

type LabRequestRow = {
  id: string
  requestNo: string
  status: string
  priority?: string
  createdAt?: string
  encounter?: { id: string } | null
  items?: Array<{
    test?: { name: string } | null
    panel?: { name: string } | null
    orderableTest?: { name: string } | null
  }>
}

type RadiologyRequestRow = {
  id: string
  requestNo: string
  status: string
  priority?: string
  bodyPart?: string
  encounter?: { id: string } | null
  modality?: { name: string } | null
}

type LabInboxItem = {
  id: string
  value?: string
  unit?: string | null
  flag?: string
  isCritical?: boolean
  reviewedAt?: string | null
  verifiedAt?: string | null
  referenceRange?: string | null
  requestItem?: {
    test?: { name: string } | null
    panel?: { name: string } | null
    orderableTest?: { name: string } | null
    request?: {
      requestNo?: string
      encounter?: { id: string } | null
    }
  }
}

type RadiologyInboxItem = {
  id: string
  impression?: string
  findings?: string
  reviewedAt?: string | null
  request?: {
    requestNo?: string
    encounter?: { id: string } | null
    modality?: { name: string }
  }
}

const OPEN_LAB = new Set(['requested', 'sample_collected', 'processing', 'resulted'])
const OPEN_RAD = new Set(['requested', 'scheduled', 'in_progress', 'reported'])

function investigationLabel(item?: {
  test?: { name: string } | null
  panel?: { name: string } | null
  orderableTest?: { name: string } | null
}) {
  return item?.orderableTest?.name ?? item?.test?.name ?? item?.panel?.name ?? 'Investigation'
}

export function useConsultationInvestigations(patientId: string, encounterId: string) {
  const queryClient = useQueryClient()

  const labRequestsQuery = useQuery({
    queryKey: ['consultation-lab-requests', patientId],
    queryFn: () => apiRequest<LabRequestRow[]>(`/laboratory/patients/${patientId}/requests`),
    refetchInterval: 20_000,
  })
  const radRequestsQuery = useQuery({
    queryKey: ['consultation-rad-requests', patientId],
    queryFn: () => apiRequest<RadiologyRequestRow[]>(`/radiology/patients/${patientId}/requests`),
    refetchInterval: 20_000,
  })
  const labInboxQuery = useQuery({
    queryKey: ['consultation-lab-inbox', patientId],
    queryFn: () =>
      apiRequest<LabInboxItem[]>(`/laboratory/results/inbox?patientId=${encodeURIComponent(patientId)}`),
    refetchInterval: 20_000,
  })
  const radInboxQuery = useQuery({
    queryKey: ['consultation-rad-inbox', patientId],
    queryFn: () =>
      apiRequest<RadiologyInboxItem[]>(`/radiology/reports/inbox?patientId=${encodeURIComponent(patientId)}`),
    refetchInterval: 20_000,
  })

  const labRequests = labRequestsQuery.data ?? []
  const radRequests = radRequestsQuery.data ?? []
  const labInbox = labInboxQuery.data ?? []
  const radInbox = radInboxQuery.data ?? []

  const thisVisitLab = labRequests.filter((row) => row.encounter?.id === encounterId)
  const thisVisitRad = radRequests.filter((row) => row.encounter?.id === encounterId)
  const thisVisitLabResults = labInbox.filter((row) => row.requestItem?.request?.encounter?.id === encounterId)
  const thisVisitRadReports = radInbox.filter((row) => row.request?.encounter?.id === encounterId)

  const openOrders =
    thisVisitLab.filter((row) => OPEN_LAB.has(row.status)).length +
    thisVisitRad.filter((row) => OPEN_RAD.has(row.status)).length
  const unreviewedLab = thisVisitLabResults.filter((row) => !row.reviewedAt)
  const unreviewedRad = thisVisitRadReports.filter((row) => !row.reviewedAt)
  const unreviewedCount = unreviewedLab.length + unreviewedRad.length
  const unreviewedCritical = unreviewedLab.filter((row) => row.isCritical || row.flag?.includes('critical')).length

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['consultation-lab-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['consultation-rad-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['consultation-lab-inbox'] }),
      queryClient.invalidateQueries({ queryKey: ['consultation-rad-inbox'] }),
      queryClient.invalidateQueries({ queryKey: ['lab-results-inbox'] }),
      queryClient.invalidateQueries({ queryKey: ['critical-results'] }),
      queryClient.invalidateQueries({ queryKey: ['radiology-reports-inbox'] }),
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] }),
      queryClient.invalidateQueries({ queryKey: ['patient-journey'] }),
    ])
  }

  const reviewLab = useMutation({
    mutationFn: (id: string) => apiRequest(`/laboratory/results/${id}/review`, { method: 'POST' }),
    onSuccess: async () => {
      notify('Lab result reviewed', 'Result marked as reviewed for this visit.', 'success')
      await invalidate()
    },
    onError: (error: Error) => notify('Review failed', error.message, 'critical'),
  })

  const reviewRadiology = useMutation({
    mutationFn: (id: string) => apiRequest(`/radiology/reports/${id}/review`, { method: 'POST' }),
    onSuccess: async () => {
      notify('Imaging report reviewed', 'Report marked as reviewed for this visit.', 'success')
      await invalidate()
    },
    onError: (error: Error) => notify('Review failed', error.message, 'critical'),
  })

  return {
    thisVisitLab,
    thisVisitRad,
    thisVisitLabResults,
    thisVisitRadReports,
    openOrders,
    unreviewedCount,
    unreviewedCritical,
    unreviewedLab,
    unreviewedRad,
    reviewLab,
    reviewRadiology,
  }
}

function ResultCard({
  title,
  subtitle,
  value,
  range,
  flag,
  critical,
  reviewed,
  reviewing,
  onReview,
}: {
  title: string
  subtitle?: string
  value: string
  range?: string | null
  flag?: string | null
  critical?: boolean
  reviewed: boolean
  reviewing?: boolean
  onReview: () => void
}) {
  return (
    <article
      className={clsx(
        'rounded-2xl border p-4',
        critical ? 'border-rose-200 bg-rose-50/70' : 'border-slate-200 bg-white',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{title}</p>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <LabFlagBadge flag={flag} />
      </div>
      <p className="mt-3 text-lg font-bold tabular-nums text-slate-900">{value || '—'}</p>
      {range ? <p className="mt-1 text-xs text-slate-500">Reference: {range}</p> : null}
      <Button
        type="button"
        variant={reviewed ? 'secondary' : 'primary'}
        className="mt-4 w-full sm:w-auto"
        disabled={reviewed}
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

export function ConsultationResultsPanel({
  patientId,
  encounterId,
}: {
  patientId: string
  encounterId: string
}) {
  const {
    thisVisitLab,
    thisVisitRad,
    thisVisitLabResults,
    thisVisitRadReports,
    openOrders,
    unreviewedCount,
    unreviewedCritical,
    reviewLab,
    reviewRadiology,
  } = useConsultationInvestigations(patientId, encounterId)

  const pendingLab = thisVisitLabResults.filter((row) => !row.reviewedAt)
  const reviewedLab = thisVisitLabResults.filter((row) => row.reviewedAt)
  const pendingRad = thisVisitRadReports.filter((row) => !row.reviewedAt)
  const reviewedRad = thisVisitRadReports.filter((row) => row.reviewedAt)
  const inProgressLab = thisVisitLab.filter((row) => OPEN_LAB.has(row.status))
  const inProgressRad = thisVisitRad.filter((row) => OPEN_RAD.has(row.status))

  return (
    <div className="space-y-5">
      {unreviewedCritical ? (
        <Alert tone="error">
          {unreviewedCritical} critical lab value{unreviewedCritical === 1 ? '' : 's'} on this visit still need
          review before the visit can be completed.
        </Alert>
      ) : unreviewedCount ? (
        <Alert tone="warning">
          {unreviewedCount} verified result{unreviewedCount === 1 ? '' : 's'} ready for review.
        </Alert>
      ) : openOrders ? (
        <Alert tone="info">
          {openOrders} investigation{openOrders === 1 ? '' : 's'} still in progress. Use Awaiting results if you
          are waiting on laboratory or imaging.
        </Alert>
      ) : null}

      <Card className="p-5 md:p-8">
        <PageHeader
          title="Results for this visit"
          description="Review verified laboratory values and imaging reports on the same encounter. Completing the visit requires every verified result to be marked reviewed."
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              <FlaskConical className="h-4 w-4 text-teal-700" />
              Laboratory
            </h3>
            <div className="space-y-3">
              {pendingLab.map((item) => (
                <ResultCard
                  key={item.id}
                  title={investigationLabel(item.requestItem)}
                  subtitle={item.requestItem?.request?.requestNo}
                  value={[item.value, item.unit].filter(Boolean).join(' ')}
                  range={item.referenceRange}
                  flag={item.flag}
                  critical={item.isCritical}
                  reviewed={false}
                  reviewing={reviewLab.isPending}
                  onReview={() => reviewLab.mutate(item.id)}
                />
              ))}
              {inProgressLab.map((row) => (
                <div key={row.id} className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">
                        {row.items?.map((item) => investigationLabel(item)).filter(Boolean).join(', ') || row.requestNo}
                      </p>
                      <p className="text-xs text-slate-500">{row.requestNo}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {row.priority ? <LabPriorityChip priority={row.priority} /> : null}
                      <LabStatusChip status={row.status} />
                    </div>
                  </div>
                </div>
              ))}
              {reviewedLab.map((item) => (
                <ResultCard
                  key={item.id}
                  title={investigationLabel(item.requestItem)}
                  subtitle={item.requestItem?.request?.requestNo}
                  value={[item.value, item.unit].filter(Boolean).join(' ')}
                  range={item.referenceRange}
                  flag={item.flag}
                  critical={item.isCritical}
                  reviewed
                  onReview={() => undefined}
                />
              ))}
              {!pendingLab.length && !inProgressLab.length && !reviewedLab.length ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                  No laboratory orders on this visit.
                </p>
              ) : null}
            </div>
          </section>

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              <ScanLine className="h-4 w-4 text-teal-700" />
              Imaging
            </h3>
            <div className="space-y-3">
              {pendingRad.map((item) => (
                <ResultCard
                  key={item.id}
                  title={item.request?.modality?.name ?? 'Imaging report'}
                  subtitle={item.request?.requestNo}
                  value={item.impression || item.findings || 'Report ready'}
                  reviewed={false}
                  reviewing={reviewRadiology.isPending}
                  onReview={() => reviewRadiology.mutate(item.id)}
                />
              ))}
              {inProgressRad.map((row) => (
                <div key={row.id} className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">
                        {row.modality?.name ?? 'Imaging'}
                        {row.bodyPart ? ` · ${row.bodyPart}` : ''}
                      </p>
                      <p className="text-xs text-slate-500">{row.requestNo}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {row.priority ? <LabPriorityChip priority={row.priority} /> : null}
                      <LabStatusChip status={row.status} />
                    </div>
                  </div>
                </div>
              ))}
              {reviewedRad.map((item) => (
                <ResultCard
                  key={item.id}
                  title={item.request?.modality?.name ?? 'Imaging report'}
                  subtitle={item.request?.requestNo}
                  value={item.impression || item.findings || 'Report ready'}
                  reviewed
                  onReview={() => undefined}
                />
              ))}
              {!pendingRad.length && !inProgressRad.length && !reviewedRad.length ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                  No imaging orders on this visit.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </Card>

      {unreviewedCritical ? (
        <p className="flex items-center gap-2 text-sm font-medium text-rose-700">
          <AlertTriangle className="h-4 w-4" />
          Critical values must be acknowledged here before Complete visit.
        </p>
      ) : null}
    </div>
  )
}
