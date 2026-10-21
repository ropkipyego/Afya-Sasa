import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../lib/api'
import { formatPatientNoShort } from '../../lib/patient-utils'
import { formatReferringDetails } from '../../lib/referring-details'

type QueueRow = {
  id: string
  token: string
  queueType: string
  status: string
  patient?: { firstName?: string; lastName?: string; patientNo?: string }
  encounter?: {
    visitType?: string | null
    referralSource?: string | null
    referralReason?: string | null
    presentingComplaint?: string | null
    destination?: string | null
  } | null
}

export function DiagnosticCheckInArrivals({
  queueType,
  title,
}: {
  queueType: 'LAB' | 'RAD'
  title: string
}) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['visit-queue', queueType, 'WAITING'],
    queryFn: () => apiRequest<QueueRow[]>(`/queue?type=${queueType}&status=WAITING`),
    refetchInterval: 15_000,
  })

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-600">
        Reception arrivals only — not a laboratory order and not a completed test. Next action: create the
        formal request from the worklist. Imaging arrivals still need a RadWeb link when the radiographer
        reports.
      </p>
      {isLoading ? <p className="mt-3 text-sm text-slate-500">Loading arrivals…</p> : null}
      {!isLoading && !data.length ? (
        <p className="mt-3 text-sm text-slate-500">No waiting check-ins today.</p>
      ) : null}
      {data.length ? (
        <ul className="mt-3 divide-y divide-slate-100">
          {data.map((row) => {
            const referring = formatReferringDetails(row.encounter?.referralReason)
            return (
              <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                <span className="font-medium text-slate-900">
                  {row.token} · {row.patient?.firstName} {row.patient?.lastName}{' '}
                  {row.patient?.patientNo ? `(${formatPatientNoShort(row.patient.patientNo)})` : ''}
                </span>
                <span className="text-xs text-slate-600">
                  {[row.encounter?.presentingComplaint, referring || row.encounter?.referralSource]
                    .filter(Boolean)
                    .join(' · ') || 'Diagnostic check-in'}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
