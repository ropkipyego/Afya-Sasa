import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../lib/api'
import { formatPatientNoShort } from '../../lib/patient-utils'

type QueueRow = {
  id: string
  token: string
  status: string
  patient?: { firstName?: string; lastName?: string; patientNo?: string }
}

type RadiologyRequestRow = {
  id: string
  status: string
  requestNo?: string
  bodyPart?: string
  patient?: { firstName: string; lastName: string; patientNo: string }
  modality?: { name: string }
  reports?: { id: string }[]
  requestFormData?: { radwebImageUrl?: string } | null
}

export function ImagingShiftHandover() {
  const { data: arrivals = [] } = useQuery({
    queryKey: ['visit-queue', 'RAD', 'WAITING'],
    queryFn: () => apiRequest<QueueRow[]>('/queue?type=RAD&status=WAITING'),
    refetchInterval: 20_000,
  })
  const { data: requests = [] } = useQuery({
    queryKey: ['radiology-requests'],
    queryFn: () => apiRequest<RadiologyRequestRow[]>('/radiology/requests'),
    refetchInterval: 20_000,
  })

  const unreported = requests.filter(
    (row) =>
      !['verified', 'cancelled', 'reported'].includes(row.status) ||
      (row.status === 'reported' && !row.requestFormData?.radwebImageUrl),
  )

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-950">Shift handover — tell reception</p>
      <p className="mt-1 text-xs text-amber-900">
        If a radiographer shift ends before every study is reported, give this list to reception so they can
        follow up. A RadWeb image link is required before a report is marked ready.
      </p>
      {!arrivals.length && !unreported.length ? (
        <p className="mt-3 text-sm text-amber-900">Nothing outstanding for handover.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm text-amber-950">
          {arrivals.map((row) => (
            <li key={`q-${row.id}`}>
              Check-in {row.token} · {row.patient?.firstName} {row.patient?.lastName}{' '}
              {row.patient?.patientNo ? `(${formatPatientNoShort(row.patient.patientNo)})` : ''} — still waiting
            </li>
          ))}
          {unreported.map((row) => (
            <li key={`r-${row.id}`}>
              {row.requestNo ?? 'Request'} · {row.patient?.firstName} {row.patient?.lastName}{' '}
              {row.patient?.patientNo ? `(${formatPatientNoShort(row.patient.patientNo)})` : ''} ·{' '}
              {[row.modality?.name, row.bodyPart, row.status].filter(Boolean).join(' · ')}
              {!row.requestFormData?.radwebImageUrl ? ' — RadWeb link missing' : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
