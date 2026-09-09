import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Printer, X } from 'lucide-react'
import { Alert, Button, Card, PageHeader, QuickAddForm } from '../ui'
import { PatientContextHeader } from '../PatientContextHeader'
import { PatientTimeline } from '../PatientTimeline'
import { PatientCardPrint } from './PatientCardPrint'
import { useClinicalCatalog } from '../../hooks/useClinicalCatalog'
import { apiRequest } from '../../lib/api'
import { listPatientPayments } from '../../lib/payments'
import { printPatientCard } from '../../lib/print-patient-card'
import { formatKes } from '../../lib/clinical-catalog'
import { ShaEligibilityCard } from '../sha/ShaEligibilityCard'
import { notify } from '../../lib/notify'
import { formDataFromElement } from '../../lib/form-utils'

type PatientFile = {
  id: string
  patientNo: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  primaryPhone: string
  bloodGroup?: string | null
  identifiers?: { type: string; value: string }[]
  nextOfKin?: { name: string; relationship: string; primaryPhone: string; isEmergencyContact?: boolean }[]
  allergies?: { allergen: string; severity: string }[]
  chronicConditions?: { name: string; status: string }[]
}

type FileTab = 'file' | 'timeline' | 'payments'

export function PatientFileModal({
  patientId,
  onClose,
}: {
  patientId: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { data: catalog } = useClinicalCatalog()
  const [tab, setTab] = useState<FileTab>('file')
  const [printing, setPrinting] = useState(false)

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => apiRequest<PatientFile>(`/patients/${patientId}`),
  })
  const { data: qrCard } = useQuery({
    queryKey: ['patient-qr-card', patientId],
    queryFn: () =>
      apiRequest<{ qrDataUrl: string; qrCode: string }>(`/patients/${patientId}/qr-card`),
  })
  const { data: timeline } = useQuery({
    queryKey: ['patient-timeline', patientId],
    queryFn: () =>
      apiRequest<{
        events: { type: string; occurredAt: string; title: string; summary: string }[]
      }>(`/patients/${patientId}/timeline`),
  })
  const { data: payments = [] } = useQuery({
    queryKey: ['patient-payments', patientId],
    queryFn: () => listPatientPayments(patientId),
  })

  const invalidatePatient = async () => {
    await queryClient.invalidateQueries({ queryKey: ['patient', patientId] })
    await queryClient.invalidateQueries({ queryKey: ['patient-timeline', patientId] })
  }

  const addIdentifier = useMutation({
    mutationFn: (form: HTMLFormElement) => {
      const data = formDataFromElement(form)
      return apiRequest(`/patients/${patientId}/identifiers`, {
        method: 'POST',
        body: JSON.stringify({ type: data.get('type'), value: data.get('value'), isPrimary: false }),
      })
    },
    onSuccess: invalidatePatient,
  })
  const addNok = useMutation({
    mutationFn: (form: HTMLFormElement) => {
      const data = formDataFromElement(form)
      return apiRequest(`/patients/${patientId}/next-of-kin`, {
        method: 'POST',
        body: JSON.stringify({
          name: data.get('name'),
          relationship: data.get('relationship'),
          primaryPhone: data.get('primaryPhone'),
          isEmergencyContact: true,
        }),
      })
    },
    onSuccess: invalidatePatient,
  })
  const addAllergy = useMutation({
    mutationFn: (form: HTMLFormElement) => {
      const data = formDataFromElement(form)
      return apiRequest(`/patients/${patientId}/allergies`, {
        method: 'POST',
        body: JSON.stringify({
          allergen: data.get('allergen'),
          type: data.get('type'),
          reaction: data.get('reaction'),
          severity: data.get('severity'),
        }),
      })
    },
    onSuccess: invalidatePatient,
  })
  const addCondition = useMutation({
    mutationFn: (form: HTMLFormElement) => {
      const data = formDataFromElement(form)
      return apiRequest(`/patients/${patientId}/chronic-conditions`, {
        method: 'POST',
        body: JSON.stringify({
          name: data.get('name'),
          icd10Code: data.get('icd10Code'),
          status: data.get('status'),
        }),
      })
    },
    onSuccess: invalidatePatient,
  })

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const events = timeline?.events ?? []
  const counts = {
    visits: events.filter((e) => e.type === 'visit').length,
    labs: events.filter((e) => e.type === 'lab_request' || e.type === 'lab_result').length,
    imaging: events.filter((e) => e.type === 'radiology' || e.type === 'radiology_request').length,
    pharmacy: events.filter((e) => e.type.startsWith('pharmacy')).length,
    payments: events.filter((e) => e.type === 'payment').length,
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-file-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Patient file</p>
            <h2 id="patient-file-title" className="text-xl font-bold text-slate-900">
              {patient ? `${patient.firstName} ${patient.lastName}` : 'Loading…'}
            </h2>
            {patient ? (
              <p className="text-sm text-slate-500">
                {patient.patientNo} · {patient.gender} · DOB {patient.dateOfBirth}
              </p>
            ) : null}
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>

        <div className="flex gap-2 border-b border-slate-100 px-5 py-2 sm:px-6">
          {(
            [
              ['file', 'File'],
              ['timeline', `Everything done (${events.length})`],
              ['payments', `Payments (${payments.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={
                tab === id
                  ? 'rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white'
                  : 'rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100'
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {isLoading || !patient ? (
            <p className="text-slate-500">Loading patient file…</p>
          ) : (
            <>
              {tab === 'file' ? (
                <div className="space-y-6">
                  <PatientContextHeader patient={patient} sticky={false} showWorkflow={false} />
                  <ShaEligibilityCard patientId={patient.id} />
                  <div className="grid gap-3 sm:grid-cols-5">
                    <Stat label="Visits" value={counts.visits} />
                    <Stat label="Lab" value={counts.labs} />
                    <Stat label="Imaging" value={counts.imaging} />
                    <Stat label="Pharmacy" value={counts.pharmacy} />
                    <Stat label="Payments" value={counts.payments} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="p-4">
                      <p className="text-xs font-bold uppercase text-slate-500">Identifiers</p>
                      {patient.identifiers?.length ? (
                        patient.identifiers.map((row) => (
                          <p key={`${row.type}-${row.value}`} className="mt-2 text-sm">
                            {row.type}: {row.value}
                          </p>
                        ))
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">None recorded</p>
                      )}
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs font-bold uppercase text-slate-500">Next of kin</p>
                      {patient.nextOfKin?.length ? (
                        patient.nextOfKin.map((row) => (
                          <p key={`${row.name}-${row.primaryPhone}`} className="mt-2 text-sm">
                            {row.name} ({row.relationship}) · {row.primaryPhone}
                          </p>
                        ))
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">None recorded</p>
                      )}
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs font-bold uppercase text-slate-500">Allergies</p>
                      {patient.allergies?.length ? (
                        patient.allergies.map((row) => (
                          <p key={row.allergen} className="mt-2 text-sm">
                            {row.allergen} · {row.severity}
                          </p>
                        ))
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">None recorded</p>
                      )}
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs font-bold uppercase text-slate-500">Chronic conditions</p>
                      {patient.chronicConditions?.length ? (
                        patient.chronicConditions.map((row) => (
                          <p key={row.name} className="mt-2 text-sm">
                            {row.name} · {row.status}
                          </p>
                        ))
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">None recorded</p>
                      )}
                    </Card>
                  </div>
                  <div className="flex items-center justify-between">
                    <PageHeader title="Patient card" description="Printable card with QR." />
                    <Button
                      type="button"
                      disabled={!qrCard || printing}
                      onClick={async () => {
                        setPrinting(true)
                        try {
                          await printPatientCard(patientId, catalog)
                        } catch (error) {
                          notify('Print failed', error instanceof Error ? error.message : 'Could not prepare card.', 'critical')
                        } finally {
                          setPrinting(false)
                        }
                      }}
                    >
                      <Printer className="h-4 w-4" />
                      {printing ? 'Preparing…' : 'Print card'}
                    </Button>
                  </div>
                  {qrCard ? (
                    <PatientCardPrint
                      patient={{
                        patientNo: patient.patientNo,
                        firstName: patient.firstName,
                        lastName: patient.lastName,
                        dateOfBirth: patient.dateOfBirth,
                        gender: patient.gender,
                        bloodGroup: patient.bloodGroup,
                        primaryPhone: patient.primaryPhone,
                        qrDataUrl: qrCard.qrDataUrl,
                        qrCode: qrCard.qrCode,
                        nextOfKin: patient.nextOfKin?.find((k) => k.isEmergencyContact) ?? patient.nextOfKin?.[0] ?? null,
                      }}
                      qr={qrCard}
                    />
                  ) : null}
                  <div className="grid gap-4 md:grid-cols-2">
                    <QuickAddForm
                      title="Add identifier"
                      pending={addIdentifier.isPending}
                      onSubmit={(event) => {
                        event.preventDefault()
                        addIdentifier.mutate(event.currentTarget)
                        event.currentTarget.reset()
                      }}
                    >
                      <select name="type" className="input" required>
                        <option value="national_id">National ID</option>
                        <option value="birth_certificate">Birth certificate</option>
                        <option value="alien_id">Alien ID</option>
                        <option value="refugee_id">Refugee ID</option>
                        <option value="client_registry">SHA Client Registry ID</option>
                        <option value="sha">SHA member number</option>
                        <option value="passport">Passport</option>
                      </select>
                      <input name="value" className="input" placeholder="Value" required />
                    </QuickAddForm>
                    <QuickAddForm
                      title="Add next of kin"
                      pending={addNok.isPending}
                      onSubmit={(event) => {
                        event.preventDefault()
                        addNok.mutate(event.currentTarget)
                        event.currentTarget.reset()
                      }}
                    >
                      <input name="name" className="input" placeholder="Name" required />
                      <input name="relationship" className="input" placeholder="Relationship" required />
                      <input name="primaryPhone" className="input" placeholder="Phone" required />
                    </QuickAddForm>
                    <QuickAddForm
                      title="Add allergy"
                      pending={addAllergy.isPending}
                      onSubmit={(event) => {
                        event.preventDefault()
                        addAllergy.mutate(event.currentTarget)
                        event.currentTarget.reset()
                      }}
                    >
                      <input name="allergen" className="input" placeholder="Allergen" required />
                      <select name="type" className="input" required>
                        <option value="drug">Drug</option>
                        <option value="food">Food</option>
                        <option value="environmental">Environmental</option>
                      </select>
                      <input name="reaction" className="input" placeholder="Reaction" required />
                      <select name="severity" className="input" required>
                        <option value="mild">Mild</option>
                        <option value="moderate">Moderate</option>
                        <option value="severe">Severe</option>
                      </select>
                    </QuickAddForm>
                    <QuickAddForm
                      title="Add chronic condition"
                      pending={addCondition.isPending}
                      onSubmit={(event) => {
                        event.preventDefault()
                        addCondition.mutate(event.currentTarget)
                        event.currentTarget.reset()
                      }}
                    >
                      <input name="name" className="input" placeholder="Name" required />
                      <input name="icd10Code" className="input" placeholder="ICD-10" />
                      <select name="status" className="input" required>
                        <option value="active">Active</option>
                        <option value="controlled">Controlled</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </QuickAddForm>
                  </div>
                </div>
              ) : null}

              {tab === 'timeline' ? (
                <PatientTimeline
                  events={events}
                  title="Everything done for this patient"
                  description="Visits, triage, consults, lab, imaging, pharmacy, admissions, and payments — newest first."
                />
              ) : null}

              {tab === 'payments' ? (
                <Card className="p-5">
                  <PageHeader title="Payments" description="Cashier records for this patient." />
                  {payments.length ? (
                    <div className="divide-y divide-slate-100">
                      {payments.map((row) => (
                        <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                          <div>
                            <p className="font-semibold">{row.serviceDescription || row.serviceLine || 'Payment'}</p>
                            <p className="text-xs text-slate-500">
                              {row.method} · {row.status} · {new Date(row.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <p className="font-bold text-slate-900">{formatKes(row.amount)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Alert tone="info">No payments recorded yet.</Alert>
                  )}
                </Card>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}
