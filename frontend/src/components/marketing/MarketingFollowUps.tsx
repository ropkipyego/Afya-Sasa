import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../ui'
import { apiRequest } from '../../lib/api'
import { formatPatientNoShort } from '../../lib/patient-utils'
import { openPatientFile } from '../../lib/patient-file'
import { LabEmptyState, LabModal, LabPatientStrip, LabQueueItem, LabSection } from '../investigations/lab-ui'

type ClinicalFollowUp = {
  id: string
  followUpDate: string | null
  followUpInstructions: string | null
  status: string
  encounterNo: string | null
  patient?: {
    id: string
    firstName: string
    lastName: string
    patientNo: string
    primaryPhone?: string | null
  } | null
  doctor?: { firstName: string; lastName: string } | null
}

type AppointmentRow = {
  id: string
  appointmentDate: string
  appointmentTime: string
  type: string
  status: string
  reason: string
  patient?: { id?: string; firstName: string; lastName: string; patientNo: string }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function MarketingFollowUps() {
  const today = todayIso()
  const [activeId, setActiveId] = useState<string | null>(null)

  const { data: nextVisits = [], isLoading } = useQuery({
    queryKey: ['marketing-follow-ups'],
    queryFn: () => apiRequest<ClinicalFollowUp[]>('/opd/follow-ups'),
    refetchInterval: 30_000,
  })

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => apiRequest<AppointmentRow[]>('/appointments'),
  })

  const sorted = useMemo(
    () =>
      [...nextVisits].sort((a, b) => String(a.followUpDate ?? '').localeCompare(String(b.followUpDate ?? ''))),
    [nextVisits],
  )
  const active = sorted.find((row) => row.id === activeId) ?? null
  const bookedForPatient = appointments.filter(
    (row) =>
      row.type === 'follow_up' &&
      active?.patient?.id &&
      row.patient?.id === active.patient.id &&
      row.status !== 'cancelled',
  )

  return (
    <div className="space-y-6">
      <LabSection
        title="Next visit queue"
        description="These dates come from the doctor consult. Call the patient, then book them under Appointments. Do not invent a second diary here."
      >
        {isLoading ? (
          <div className="h-48 animate-skeleton rounded-2xl" />
        ) : sorted.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map((row) => (
              <LabQueueItem
                key={row.id}
                active={activeId === row.id}
                onClick={() => setActiveId(row.id)}
                name={
                  row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : 'Unknown patient'
                }
                patientNo={row.patient?.patientNo ? formatPatientNoShort(row.patient.patientNo) : '—'}
                status={
                  !row.followUpDate
                    ? 'pending'
                    : row.followUpDate < today
                      ? 'overdue'
                      : row.followUpDate === today
                        ? 'due'
                        : 'upcoming'
                }
                priority={row.followUpDate && row.followUpDate <= today ? 'urgent' : 'routine'}
                subtitle={[row.followUpDate, row.followUpInstructions].filter(Boolean).join(' · ')}
              />
            ))}
          </div>
        ) : (
          <LabEmptyState
            title="No Next visit dates yet"
            description="When a doctor records a follow-up date on SOAP, it appears here for outreach to call."
          />
        )}
      </LabSection>

      {active ? (
        <LabModal
          title="Follow-up"
          description="Same patient as the consult. Book the return visit on the Appointments desk."
          onClose={() => setActiveId(null)}
        >
          <div className="space-y-4">
            <LabPatientStrip
              firstName={active.patient?.firstName}
              lastName={active.patient?.lastName}
              patientNo={
                active.patient?.patientNo ? formatPatientNoShort(active.patient.patientNo) : undefined
              }
              status={active.followUpDate ?? 'no date'}
            />
            <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
              <p className="font-semibold">Next visit {active.followUpDate ?? 'not set'}</p>
              <p className="mt-1">{active.followUpInstructions || 'No instructions on the consult.'}</p>
              {active.doctor ? (
                <p className="mt-2 text-xs">
                  Doctor {active.doctor.firstName} {active.doctor.lastName}
                  {active.encounterNo ? ` · ${active.encounterNo}` : ''}
                </p>
              ) : null}
              {active.patient?.primaryPhone ? (
                <p className="mt-2 font-medium">{active.patient.primaryPhone}</p>
              ) : (
                <p className="mt-2 text-xs text-teal-800">No phone on the patient file.</p>
              )}
            </div>
            {bookedForPatient.length ? (
              <p className="text-sm text-slate-600">
                Already booked:{' '}
                {bookedForPatient
                  .map((row) => `${row.appointmentDate} ${row.appointmentTime} (${row.status})`)
                  .join(' · ')}
              </p>
            ) : (
              <p className="text-sm text-slate-600">No follow-up appointment booked yet for this patient.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {active.patient?.id ? (
                <Button type="button" variant="secondary" onClick={() => openPatientFile(active.patient!.id)}>
                  Open patient file
                </Button>
              ) : null}
            </div>
          </div>
        </LabModal>
      ) : null}
    </div>
  )
}
