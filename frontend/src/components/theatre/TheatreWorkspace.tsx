import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Alert, Button, Card, Field, PageHeader, SelectField, TextareaField } from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { formDataFromElement } from '../../lib/form-utils'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'
import { useClinicalCatalog } from '../../hooks/useClinicalCatalog'
import { doctorSelectOptions } from '../../lib/clinical-catalog'

type BookingRow = {
  id: string
  bookingNo: string
  status: string
  priority: string
  scheduledStartAt: string
  patient?: { firstName: string; lastName: string; patientNo: string }
  procedure?: { name: string }
  theatre?: { name: string } | null
}

const stages = [
  { id: 'requested', label: 'Requested' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'pre_op', label: 'Pre-op' },
  { id: 'in_theatre', label: 'In theatre' },
  { id: 'recovery', label: 'Recovery' },
  { id: 'completed', label: 'Completed' },
] as const

export function TheatreWorkspace() {
  const queryClient = useQueryClient()
  const { data: catalog } = useClinicalCatalog()
  const staff = doctorSelectOptions(catalog)
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchItem | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const { data: theatres = [] } = useQuery({
    queryKey: ['theatres'],
    queryFn: () => apiRequest<{ id: string; name: string }[]>('/theatre/theatres'),
  })
  const { data: procedures = [] } = useQuery({
    queryKey: ['surgical-procedures'],
    queryFn: () => apiRequest<{ id: string; name: string }[]>('/theatre/procedures'),
  })
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['surgery-bookings'],
    queryFn: () => apiRequest<BookingRow[]>('/theatre/bookings'),
    refetchInterval: 30_000,
  })

  const active = bookings.find((b) => b.id === activeId) ?? null

  const byStage = useMemo(() => {
    const map: Record<string, BookingRow[]> = {}
    for (const s of stages) map[s.id] = []
    for (const b of bookings) {
      if (map[b.status]) map[b.status].push(b)
      else map.requested?.push(b)
    }
    return map
  }, [bookings])

  const createBooking = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      if (!selectedPatient) throw new Error('Select a patient first.')
      const form = formDataFromElement(formElement)
      return apiRequest('/theatre/bookings', {
        method: 'POST',
        body: JSON.stringify({
          patientId: selectedPatient.id,
          procedureId: form.get('procedureId'),
          theatreId: form.get('theatreId') || undefined,
          scheduledStartAt: form.get('scheduledStartAt'),
          priority: form.get('priority'),
        }),
      })
    },
    onSuccess: async () => {
      notify('Surgery booked', 'Booking added to theatre schedule.', 'success')
      setSelectedPatient(null)
      await queryClient.invalidateQueries({ queryKey: ['surgery-bookings'] })
    },
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest(`/theatre/bookings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['surgery-bookings'] }),
  })

  const assignStaff = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest(`/theatre/bookings/${form.get('bookingId')}/staff`, {
        method: 'POST',
        body: JSON.stringify({ userId: form.get('userId'), role: form.get('role') }),
      })
    },
    onSuccess: () => notify('Staff assigned', 'Surgical team updated.', 'success'),
  })

  const addNote = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest(`/theatre/bookings/${form.get('bookingId')}/notes`, {
        method: 'POST',
        body: JSON.stringify({ type: form.get('type'), body: form.get('body') }),
      })
    },
    onSuccess: () => notify('Note saved', 'Surgery note recorded.', 'success'),
  })

  return (
    <div className="workspace-shell animate-fade-in">
      <PageHeader title="Theatre operations" description="Schedule surgeries, assign staff, and track case progress." />

      <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-5 md:p-8">
          <PageHeader title="Book surgery" description="Select patient, procedure, and slot." />
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              createBooking.mutate(e.currentTarget)
            }}
          >
            <PatientSearchAutocomplete selected={selectedPatient} onSelect={setSelectedPatient} />
            <SelectField name="procedureId" label="Procedure" required>
              <option value="">Select procedure</option>
              {procedures.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectField>
            <SelectField name="theatreId" label="Theatre">
              <option value="">Assign later</option>
              {theatres.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </SelectField>
            <Field name="scheduledStartAt" label="Scheduled start" type="datetime-local" required />
            <SelectField name="priority" label="Priority" defaultValue="elective">
              <option value="elective">Elective</option>
              <option value="urgent">Urgent</option>
              <option value="emergency">Emergency</option>
            </SelectField>
            {createBooking.isError ? <Alert tone="error">{createBooking.error.message}</Alert> : null}
            <Button type="submit" loading={createBooking.isPending} disabled={!selectedPatient}>
              Book surgery
            </Button>
          </form>
        </Card>

        <Card className="p-5 md:p-8">
          <PageHeader title="Schedule board" description="Click a case to manage status, staff, and notes." />
          {isLoading ? (
            <div className="mt-6 h-48 animate-skeleton rounded-xl" />
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {bookings.slice(0, 8).map((booking) => (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => setActiveId(booking.id)}
                  className={clsx(
                    'rounded-xl border p-4 text-left transition',
                    activeId === booking.id ? 'border-teal-400 ring-2 ring-teal-200' : 'border-slate-200 hover:bg-slate-50',
                  )}
                >
                  <p className="font-semibold">
                    {booking.patient?.firstName} {booking.patient?.lastName}
                  </p>
                  <p className="text-xs text-slate-500">{booking.bookingNo} · {booking.procedure?.name}</p>
                  <p className="mt-2 text-[10px] font-bold uppercase text-amber-700">{booking.status}</p>
                </button>
              ))}
              {!bookings.length ? <p className="text-sm text-slate-500">No bookings yet.</p> : null}
            </div>
          )}
        </Card>
      </div>

      {active ? (
        <Card className="p-5 md:p-8">
          <PageHeader
            title={`Case ${active.bookingNo}`}
            description={`${active.patient?.firstName ?? ''} ${active.patient?.lastName ?? ''} — ${active.procedure?.name ?? ''}`}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {stages.map((stage) => (
              <Button
                key={stage.id}
                type="button"
                variant={active.status === stage.id ? 'primary' : 'secondary'}
                loading={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ id: active.id, status: stage.id })}
              >
                {stage.label}
              </Button>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <form
              className="space-y-3 rounded-2xl border border-slate-200 p-4"
              onSubmit={(e) => {
                e.preventDefault()
                assignStaff.mutate(e.currentTarget)
              }}
            >
              <p className="text-sm font-semibold">Assign staff</p>
              <input type="hidden" name="bookingId" value={active.id} />
              <SelectField name="userId" label="Staff member" required>
                <option value="">Select</option>
                {staff.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </SelectField>
              <SelectField name="role" label="Role" required defaultValue="primary_surgeon">
                <option value="primary_surgeon">Primary surgeon</option>
                <option value="assistant_surgeon">Assistant surgeon</option>
                <option value="anesthetist">Anesthetist</option>
                <option value="theatre_nurse">Theatre nurse</option>
              </SelectField>
              <Button type="submit" loading={assignStaff.isPending}>
                Assign
              </Button>
            </form>

            <form
              className="space-y-3 rounded-2xl border border-slate-200 p-4"
              onSubmit={(e) => {
                e.preventDefault()
                addNote.mutate(e.currentTarget)
                e.currentTarget.reset()
              }}
            >
              <p className="text-sm font-semibold">Surgery note</p>
              <input type="hidden" name="bookingId" value={active.id} />
              <SelectField name="type" label="Note type" defaultValue="intra_op">
                <option value="pre_op">Pre-op</option>
                <option value="intra_op">Intra-op</option>
                <option value="post_op">Post-op</option>
              </SelectField>
              <TextareaField name="body" label="Note" required />
              <Button type="submit" loading={addNote.isPending}>
                Save note
              </Button>
            </form>
          </div>
        </Card>
      ) : null}

      <div className="lab-kanban">
        {stages.map((stage) => (
          <section key={stage.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-bold uppercase">{stage.label}</h3>
            <p className="text-2xl font-bold tabular-nums">{byStage[stage.id]?.length ?? 0}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
