import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CalendarDays } from 'lucide-react'
import { Alert, Button, Card, Field, PageHeader, SelectField } from '../ui'
import { DEFAULT_TENANT } from '../../lib/tenant-config'

type PublicSlot = {
  id: string
  date: string
  startTime: string
  endTime: string
  remaining: number
  doctorName: string
}

type Booked = {
  appointmentDate: string
  appointmentTime: string
  patientName: string
  patientNo: string
  doctorName: string
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

async function publicRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant': DEFAULT_TENANT,
      ...(init?.headers ?? {}),
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(typeof body.message === 'string' ? body.message : 'Could not complete the booking.')
  }
  return body as T
}

export function PublicAppointmentBooking() {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [hospitalNumberOrPhone, setHospitalNumberOrPhone] = useState('')
  const [slotId, setSlotId] = useState('')
  const [type, setType] = useState('new')
  const [reason, setReason] = useState('')

  const slotsQuery = useQuery({
    queryKey: ['public-appointment-slots', date],
    queryFn: () => publicRequest<PublicSlot[]>(`/public/appointments/slots?date=${encodeURIComponent(date)}`),
  })

  const slots = slotsQuery.data ?? []
  const selected = useMemo(() => slots.find((row) => row.id === slotId) ?? null, [slots, slotId])

  const book = useMutation({
    mutationFn: () =>
      publicRequest<Booked>('/public/appointments', {
        method: 'POST',
        body: JSON.stringify({ hospitalNumberOrPhone, slotId, type, reason }),
      }),
  })

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-lg space-y-6">
        <PageHeader
          title="Book a clinic appointment"
          description="Use the hospital number or the phone from registration. New patients register at reception first. This writes the same appointment list used at the front desk."
        />
        {book.data ? (
          <Card className="p-6">
            <p className="text-sm font-semibold text-emerald-800">Appointment requested</p>
            <p className="mt-2 text-sm text-slate-700">
              {book.data.patientName} ({book.data.patientNo}) · {book.data.appointmentDate} at{' '}
              {book.data.appointmentTime} · {book.data.doctorName}
            </p>
            <p className="mt-3 text-xs text-slate-500">Reception will confirm the slot. Bring the hospital number.</p>
            <a className="mt-4 inline-block text-sm font-medium text-teal-700" href="/">
              Back to staff sign in
            </a>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="space-y-3">
              <Field
                name="hospitalNumberOrPhone"
                label="Hospital number or registered phone"
                value={hospitalNumberOrPhone}
                onChange={(event) => setHospitalNumberOrPhone(event.target.value)}
                required
              />
              <Field
                name="appointmentDate"
                label="Date"
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value)
                  setSlotId('')
                }}
                required
              />
              <SelectField
                name="slotId"
                label="Available slot"
                value={slotId}
                onChange={(event) => setSlotId(event.target.value)}
                required
              >
                <option value="">{slotsQuery.isLoading ? 'Loading slots…' : 'Select a time'}</option>
                {slots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.startTime}–{slot.endTime} · {slot.doctorName} · {slot.remaining} left
                  </option>
                ))}
              </SelectField>
              {!slotsQuery.isLoading && !slots.length ? (
                <Alert tone="info">No open clinic slots on this date. Reception can still book a desk appointment.</Alert>
              ) : null}
              <SelectField name="type" label="Visit type" value={type} onChange={(event) => setType(event.target.value)}>
                <option value="new">New visit</option>
                <option value="follow_up">Follow-up</option>
                <option value="review">Review</option>
                <option value="antenatal">Antenatal</option>
                <option value="procedure">Procedure</option>
              </SelectField>
              <Field
                name="reason"
                label="Reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
              />
              {selected ? (
                <p className="text-xs text-slate-500">
                  <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                  {selected.date} {selected.startTime} with {selected.doctorName}
                </p>
              ) : null}
              {book.error ? <Alert tone="error">{(book.error as Error).message}</Alert> : null}
              <Button
                type="button"
                loading={book.isPending}
                disabled={!hospitalNumberOrPhone.trim() || !slotId || !reason.trim()}
                onClick={() => book.mutate()}
              >
                Request appointment
              </Button>
            </div>
          </Card>
        )}
        <p className="text-center text-xs text-slate-500">
          SHA, M-Pesa and insurance claims are not completed on this page. Staff confirm and bill in AfyaSasa.
        </p>
      </div>
    </div>
  )
}
