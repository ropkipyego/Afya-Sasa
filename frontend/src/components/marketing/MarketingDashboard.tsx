import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, MapPinned, Phone, Users } from 'lucide-react'
import { apiRequest } from '../../lib/api'
import { LabQueueItem, LabSection, LabStatCard } from '../investigations/lab-ui'
import { formatPatientNoShort } from '../../lib/patient-utils'

type ClinicalFollowUp = {
  id: string
  followUpDate: string | null
  followUpInstructions: string | null
  patient?: { firstName: string; lastName: string; patientNo: string } | null
}

type AppointmentRow = {
  id: string
  appointmentDate: string
  type: string
  status: string
  reason: string
  patient?: { firstName: string; lastName: string; patientNo: string }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function MarketingDashboard({ onOpenFollowUps }: { onOpenFollowUps?: () => void }) {
  const today = todayIso()

  const { data: nextVisits = [], isLoading: nextLoading } = useQuery({
    queryKey: ['marketing-follow-ups'],
    queryFn: () => apiRequest<ClinicalFollowUp[]>('/opd/follow-ups'),
    refetchInterval: 30_000,
  })

  const { data: appointments = [], isLoading: apptLoading } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => apiRequest<AppointmentRow[]>('/appointments'),
    refetchInterval: 30_000,
  })

  const { data: visits = [] } = useQuery({
    queryKey: ['marketing-visits'],
    queryFn: () => apiRequest<Array<{ visitDate: string }>>('/marketing/visits'),
    refetchInterval: 30_000,
  })

  const bookedFollowUps = appointments.filter((row) => row.type === 'follow_up')
  const dueToday = nextVisits.filter((row) => row.followUpDate === today)
  const overdue = nextVisits.filter((row) => row.followUpDate && row.followUpDate < today)
  const upcoming = nextVisits
    .filter((row) => row.followUpDate && row.followUpDate >= today)
    .slice(0, 8)

  const loading = nextLoading || apptLoading
  const openBookings = useMemo(
    () => bookedFollowUps.filter((row) => row.status !== 'cancelled' && row.status !== 'completed'),
    [bookedFollowUps],
  )

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-skeleton rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <LabStatCard
          label="Due today"
          value={dueToday.length}
          icon={Phone}
          tone="border-teal-200/80 bg-gradient-to-br from-teal-50 to-white text-teal-950"
          hint="Doctor Next visit date is today"
        />
        <LabStatCard
          label="Overdue"
          value={overdue.length}
          icon={CalendarClock}
          tone="border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-950"
          hint="Next visit date has passed"
        />
        <LabStatCard
          label="Booked follow-ups"
          value={openBookings.length}
          icon={Users}
          tone="border-sky-200 bg-gradient-to-br from-sky-50 to-white text-sky-950"
          hint="Appointments typed as follow-up"
        />
        <LabStatCard
          label="Daily report"
          value={visits.filter((row) => row.visitDate === today).length}
          icon={MapPinned}
          tone="border-slate-200 bg-gradient-to-br from-slate-50 to-white text-slate-950"
          hint="Facility visits logged today"
        />
      </div>

      <LabSection
        title="This desk"
        description="Marketing is outreach. It is not Front Office, not Finance, and not Appointments. Reception books. Cashier collects. Marketing chases Next visit and logs facility visits."
      >
        <ul className="grid gap-3 text-sm text-slate-700 md:grid-cols-3">
          <li className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="font-semibold text-slate-900">Follow-ups</p>
            <p className="mt-1 text-slate-600">
              Doctor writes Next visit on the consult. This list is that date — call the patient and book them in Appointments.
            </p>
          </li>
          <li className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="font-semibold text-slate-900">Daily report</p>
            <p className="mt-1 text-slate-600">
              One officer, one day, many facilities. That log is not the same as a clinic appointment.
            </p>
          </li>
          <li className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="font-semibold text-slate-900">Do not mix</p>
            <p className="mt-1 text-slate-600">
              Do not put this under Register or Finance. Those desks will keep growing on their own jobs.
            </p>
          </li>
        </ul>
      </LabSection>

      <LabSection
        title="Next visits coming up"
        description="From the doctor SOAP follow-up date. Open the list to work the queue."
      >
        {upcoming.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {upcoming.map((row) => (
              <LabQueueItem
                key={row.id}
                onClick={() => onOpenFollowUps?.()}
                name={
                  row.patient
                    ? `${row.patient.firstName} ${row.patient.lastName}`
                    : 'Unknown patient'
                }
                patientNo={
                  row.patient?.patientNo ? formatPatientNoShort(row.patient.patientNo) : '—'
                }
                status={row.followUpDate === today ? 'due' : 'upcoming'}
                priority="routine"
                subtitle={[row.followUpDate, row.followUpInstructions].filter(Boolean).join(' · ') || 'No instructions'}
              />
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">
            No Next visit dates on file yet. They appear when a doctor completes SOAP with a follow-up date.
          </p>
        )}
      </LabSection>
    </div>
  )
}
