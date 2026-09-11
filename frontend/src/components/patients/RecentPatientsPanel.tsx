import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card } from '../ui'
import { apiRequest } from '../../lib/api'
import { calcAge, formatPatientNoShort } from '../../lib/patient-utils'
import { mapEncounterStatusToWorkflow, workflowStepLabels } from '../../lib/workflow-status'

export type RecentPatient = {
  id: string
  patientNo: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  primaryPhone: string
  createdAt: string
}

type EncounterRow = {
  id: string
  status: string
  startedAt: string
  patient?: RecentPatient
}

function nairobiDayKey(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function toRecentPatient(patient: RecentPatient): RecentPatient {
  return {
    id: patient.id,
    patientNo: patient.patientNo,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth,
    gender: patient.gender,
    primaryPhone: patient.primaryPhone,
    createdAt: patient.createdAt,
  }
}

export function RecentPatientsPanel({
  onView,
  onQuickCheckIn,
  limit = 20,
}: {
  onView: (patient: RecentPatient) => void
  onQuickCheckIn: (patient: RecentPatient) => void
  limit?: number
}) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['recent-patients', limit],
    queryFn: () =>
      apiRequest<{ items: RecentPatient[]; meta: { pageSize: number; total: number } }>(
        `/patients?pageSize=${Math.max(limit, 40)}`,
      ),
  })

  const { data: encounters = [] } = useQuery({
    queryKey: ['recent-patients-encounters'],
    queryFn: () => apiRequest<EncounterRow[]>('/opd/encounters'),
    retry: false,
  })

  const todayKey = nairobiDayKey(new Date())
  const checkInByPatient = useMemo(() => {
    const map = new Map<string, EncounterRow>()
    for (const encounter of encounters) {
      const patientId = encounter.patient?.id
      if (!patientId || nairobiDayKey(encounter.startedAt) !== todayKey) continue
      const existing = map.get(patientId)
      if (!existing || new Date(encounter.startedAt) > new Date(existing.startedAt)) {
        map.set(patientId, encounter)
      }
    }
    return map
  }, [encounters, todayKey])

  const patients = useMemo(() => {
    const activityAt = new Map<string, string>()
    const byId = new Map<string, RecentPatient>()

    const newestEncounters = [...encounters].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    )
    for (const encounter of newestEncounters) {
      const patient = encounter.patient
      if (!patient?.id || byId.has(patient.id)) continue
      byId.set(patient.id, {
        ...toRecentPatient(patient),
        createdAt: patient.createdAt || encounter.startedAt,
      })
      activityAt.set(patient.id, encounter.startedAt)
    }

    for (const patient of data?.items ?? []) {
      if (nairobiDayKey(patient.createdAt) !== todayKey) continue
      if (!byId.has(patient.id)) byId.set(patient.id, patient)
      const existing = activityAt.get(patient.id)
      if (!existing || new Date(patient.createdAt) > new Date(existing)) {
        activityAt.set(patient.id, patient.createdAt)
      }
    }

    return [...byId.values()]
      .sort((a, b) => {
        const aAt = activityAt.get(a.id) ?? a.createdAt
        const bAt = activityAt.get(b.id) ?? b.createdAt
        return new Date(bAt).getTime() - new Date(aAt).getTime()
      })
      .slice(0, limit)
  }, [data?.items, encounters, limit, todayKey])

  const todayCount = patients.filter(
    (patient) => checkInByPatient.has(patient.id) || nairobiDayKey(patient.createdAt) === todayKey,
  ).length

  return (
    <Card className="p-4 md:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-teal-700">OPD Check-In</p>
          <h3 className="text-base font-bold text-slate-900">Today&apos;s patients</h3>
        </div>
        <p className="text-xs text-slate-500">
          Up to {limit} · {todayCount} from today
        </p>
      </div>
      {isLoading ? <p className="py-6 text-sm text-slate-500">Loading today&apos;s patients…</p> : null}
      {isError ? (
        <Alert tone="error">{error instanceof Error ? error.message : 'Could not load recent patients.'}</Alert>
      ) : null}
      {!isLoading && !isError && !patients.length ? (
        <p className="py-6 text-sm text-slate-500">No patients for today yet.</p>
      ) : null}
      {patients.length ? (
        <div className="max-h-[28rem] overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-white text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-3">Patient</th>
                <th className="py-2 pr-3">Age/sex</th>
                <th className="py-2 pr-3">Registered</th>
                <th className="py-2 pr-3">Today</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patients.map((patient) => {
                const visit = checkInByPatient.get(patient.id)
                const todayLabel = visit
                  ? workflowStepLabels[mapEncounterStatusToWorkflow(visit.status)]
                  : nairobiDayKey(patient.createdAt) === todayKey
                    ? 'Registered today'
                    : 'Not checked in'
                return (
                  <tr key={patient.id} className="align-middle">
                    <td className="py-2.5 pr-3">
                      <p className="font-semibold text-slate-900">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <p className="text-xs text-slate-500" title={patient.patientNo}>
                        {formatPatientNoShort(patient.patientNo)}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-700">
                      {calcAge(patient.dateOfBirth)} / {patient.gender}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-slate-600">
                      {new Date(patient.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={
                          visit
                            ? 'rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800'
                            : 'text-xs text-slate-500'
                        }
                      >
                        {todayLabel}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" className="px-2 py-1.5 text-xs" onClick={() => onView(patient)}>
                          View
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-2 py-1.5 text-xs"
                          disabled={Boolean(visit)}
                          onClick={() => onQuickCheckIn(patient)}
                        >
                          {visit ? 'Already in' : 'Quick Check-In'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  )
}
