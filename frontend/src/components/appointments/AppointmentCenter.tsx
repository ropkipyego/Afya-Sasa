import { useMemo, useState } from 'react'
import { formDataFromElement } from '../../lib/form-utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, CheckCircle2, Clock, XCircle } from 'lucide-react'
import clsx from 'clsx'
import {
  Alert,
  Button,
  Card,
  Field,
  PageHeader,
  SelectField,
} from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'
import { useClinicalCatalog } from '../../hooks/useClinicalCatalog'
import { doctorSelectOptions } from '../../lib/clinical-catalog'

type AppointmentRow = {
  id: string
  appointmentDate: string
  appointmentTime: string
  type: string
  reason: string
  status: string
  patient: { id: string; firstName: string; lastName: string; patientNo: string }
  doctor?: { id: string; firstName: string; lastName: string } | null
}

const workflowSteps = [
  'scheduled',
  'confirmed',
  'arrived',
  'completed',
  'no_show',
  'cancelled',
] as const

const statusLabels: Record<string, string> = {
  scheduled: 'Booked',
  confirmed: 'Confirmed',
  arrived: 'Arrived',
  completed: 'Completed',
  no_show: 'No show',
  cancelled: 'Cancelled',
}

const statusTone: Record<string, string> = {
  scheduled: 'bg-sky-50 text-sky-800 border-sky-200',
  confirmed: 'bg-teal-50 text-teal-800 border-teal-200',
  arrived: 'bg-amber-50 text-amber-900 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  no_show: 'bg-orange-50 text-orange-900 border-orange-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
}

type DashboardTab = 'today' | 'upcoming' | 'missed' | 'completed' | 'cancelled'
type CalendarView = 'day' | 'week' | 'month'

export function AppointmentCenter() {
  const queryClient = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const [tab, setTab] = useState<DashboardTab>('today')
  const [view, setView] = useState<CalendarView>('week')
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchItem | null>(null)

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => apiRequest<AppointmentRow[]>('/appointments'),
    refetchInterval: 30_000,
  })

  const { data: todayList = [] } = useQuery({
    queryKey: ['appointments-today'],
    queryFn: () => apiRequest<AppointmentRow[]>('/appointments/today'),
    refetchInterval: 30_000,
  })

  const { data: catalog } = useClinicalCatalog()
  const doctors = doctorSelectOptions(catalog)

  const createAppointment = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: selectedPatient?.id,
          doctorId: form.get('doctorId'),
          appointmentDate: form.get('appointmentDate'),
          appointmentTime: form.get('appointmentTime'),
          type: form.get('type'),
          reason: form.get('reason'),
        }),
      })
    },
    onSuccess: async () => {
      notify('Appointment booked', 'Patient appointment created.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['appointments'] })
      await queryClient.invalidateQueries({ queryKey: ['appointments-today'] })
    },
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest(`/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['appointments'] })
      await queryClient.invalidateQueries({ queryKey: ['appointments-today'] })
    },
  })

  const markArrived = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/appointments/${id}/arrived`, { method: 'POST' }),
    onSuccess: async () => {
      notify('Patient arrived', 'Check-in encounter created.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
  })

  const filtered = useMemo(() => {
    const source = tab === 'today' ? todayList : appointments
    switch (tab) {
      case 'upcoming':
        return source.filter((a) => a.appointmentDate >= today && !['completed', 'cancelled', 'no_show'].includes(a.status))
      case 'missed':
        return source.filter((a) => a.status === 'no_show' || (a.appointmentDate < today && a.status === 'scheduled'))
      case 'completed':
        return source.filter((a) => a.status === 'completed')
      case 'cancelled':
        return source.filter((a) => a.status === 'cancelled' || a.status === 'no_show')
      default:
        return source
    }
  }, [appointments, todayList, tab, today])

  const counts = {
    today: todayList.length,
    upcoming: appointments.filter((a) => a.appointmentDate >= today && !['completed', 'cancelled'].includes(a.status)).length,
    missed: appointments.filter((a) => a.status === 'no_show').length,
    completed: appointments.filter((a) => a.status === 'completed').length,
    cancelled: appointments.filter((a) => a.status === 'cancelled').length,
  }

  return (
    <div className="workspace-shell animate-fade-in">
      <PageHeader
        eyebrow="Reception"
        title="Appointments"
        description="Book, confirm, and track patient appointments."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {(
          [
            ['today', 'Today', counts.today, Calendar],
            ['upcoming', 'Upcoming', counts.upcoming, Clock],
            ['missed', 'Missed', counts.missed, XCircle],
            ['completed', 'Completed', counts.completed, CheckCircle2],
            ['cancelled', 'Cancelled', counts.cancelled, XCircle],
          ] as const
        ).map(([key, label, value, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={clsx(
              'card-hover rounded-2xl border p-5 text-left transition',
              tab === key ? 'border-teal-400 bg-teal-50 ring-2 ring-teal-100' : 'border-slate-200 bg-white',
            )}
          >
            <Icon className="mb-2 h-5 w-5 text-teal-600" />
            <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-5 md:p-8">
          <PageHeader title="Book appointment" description="Search patient, select doctor and slot." />
          <form
            className="mt-8 space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              createAppointment.mutate(event.currentTarget)
              event.currentTarget.reset()
            }}
          >
            <PatientSearchAutocomplete
              selected={selectedPatient}
              onSelect={setSelectedPatient}
            />
            <SelectField name="doctorId" label="Doctor" required>
              <option value="">Select doctor</option>
              {doctors.map((doc) => (
                <option key={doc.value} value={doc.value}>
                  {doc.label}
                </option>
              ))}
            </SelectField>
            <Field name="appointmentDate" label="Date" type="date" required defaultValue={today} />
            <Field name="appointmentTime" label="Time" type="time" required />
            <SelectField name="type" label="Appointment type" required>
              <option value="new">New visit</option>
              <option value="follow_up">Follow-up</option>
              <option value="procedure">Procedure</option>
              <option value="review">Review</option>
              <option value="antenatal">Antenatal</option>
            </SelectField>
            <Field name="reason" label="Reason" required />
            {createAppointment.isError ? (
              <Alert tone="error">{createAppointment.error.message}</Alert>
            ) : null}
            <Button type="submit" loading={createAppointment.isPending} disabled={!selectedPatient}>
              Book appointment
            </Button>
          </form>
        </Card>

        <Card className="p-5 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <PageHeader title="Schedule" description="Status workflow and calendar views." />
            <div className="flex rounded-xl border border-slate-200 p-1">
              {(['day', 'week', 'month'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={clsx(
                    'touch-target rounded-lg px-4 py-2 text-xs font-semibold capitalize',
                    view === v ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {workflowSteps.map((step) => (
              <span
                key={step}
                className={clsx('rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase', statusTone[step])}
              >
                {statusLabels[step]}
              </span>
            ))}
          </div>

          {isLoading ? (
            <div className="mt-6 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 animate-skeleton rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {filtered.map((appt) => (
                <div
                  key={appt.id}
                  className="card-hover rounded-2xl border border-slate-200 p-5 queue-item-enter"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {appt.patient.firstName} {appt.patient.lastName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {appt.appointmentDate} · {appt.appointmentTime} · {appt.type}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{appt.reason}</p>
                      {appt.doctor ? (
                        <p className="text-xs text-slate-500">
                          Dr. {appt.doctor.firstName} {appt.doctor.lastName}
                        </p>
                      ) : null}
                    </div>
                    <span className={clsx('rounded-full border px-3 py-1 text-xs font-bold', statusTone[appt.status])}>
                      {statusLabels[appt.status] ?? appt.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {appt.status === 'scheduled' ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="text-xs"
                        onClick={() => updateStatus.mutate({ id: appt.id, status: 'confirmed' })}
                      >
                        Confirm
                      </Button>
                    ) : null}
                    {['scheduled', 'confirmed'].includes(appt.status) ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="text-xs"
                        onClick={() => markArrived.mutate(appt.id)}
                      >
                        Mark arrived
                      </Button>
                    ) : null}
                    {!['completed', 'cancelled'].includes(appt.status) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs"
                        onClick={() => updateStatus.mutate({ id: appt.id, status: 'completed' })}
                      >
                        Complete
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
              {!filtered.length ? (
                <p className="py-12 text-center text-sm text-slate-500">No appointments in this view.</p>
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
