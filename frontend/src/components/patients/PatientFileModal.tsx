import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Printer, Stethoscope, UserRoundPen, X } from 'lucide-react'
import { Alert, Button, Card, PageHeader } from '../ui'
import { PatientTimeline } from '../PatientTimeline'
import { PatientRegistrationForm } from '../PatientRegistrationForm'
import { useClinicalCatalog } from '../../hooks/useClinicalCatalog'
import { apiRequest } from '../../lib/api'
import { listPatientDocuments } from '../../lib/clinical-documents'
import { listPatientPayments } from '../../lib/payments'
import { printPatientCard } from '../../lib/print-patient-card'
import { formatKes } from '../../lib/clinical-catalog'
import { notify } from '../../lib/notify'
import { calcAge, formatPatientName } from '../../lib/patient-utils'
import { useAuthStore } from '../../lib/auth-store'

type PatientFile = {
  id: string
  patientNo: string
  firstName: string
  lastName: string
  middleName?: string | null
  dateOfBirth: string
  gender: string
  primaryPhone: string
  secondaryPhone?: string | null
  email?: string | null
  bloodGroup?: string | null
  county?: string | null
  subCounty?: string | null
  nationality?: string | null
  maritalStatus?: string | null
  occupation?: string | null
  religion?: string | null
  identifiers?: { type: string; value: string }[]
  nextOfKin?: { name: string; relationship: string; primaryPhone: string; isEmergencyContact?: boolean }[]
  allergies?: { allergen: string; severity: string }[]
  chronicConditions?: { name: string; status: string }[]
  createdAt?: string
}

type JourneyStatus = {
  step?: string
  encounterStatus?: string | null
}

type FileTab = 'overview' | 'demographics' | 'visits' | 'history' | 'documents'

type EncounterRow = {
  id: string
  encounterNo?: string
  status: string
  startedAt: string
  visitType?: string
  departmentName?: string | null
}

export function PatientFileModal({
  patientId,
  onClose,
  onQuickCheckIn,
}: {
  patientId: string
  onClose: () => void
  onQuickCheckIn?: (patient: {
    id: string
    patientNo: string
    firstName: string
    lastName: string
    dateOfBirth: string
    gender: string
    primaryPhone: string
  }) => void
}) {
  const queryClient = useQueryClient()
  const { data: catalog } = useClinicalCatalog()
  const canEditPatient = useAuthStore((state) =>
    Boolean(state.user?.permissions.includes('patients:update')),
  )
  const [tab, setTab] = useState<FileTab>('overview')
  const [printing, setPrinting] = useState(false)
  const [editing, setEditing] = useState(false)

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => apiRequest<PatientFile>(`/patients/${patientId}`),
  })
  const { data: journey } = useQuery({
    queryKey: ['patient-journey', patientId],
    queryFn: () => apiRequest<JourneyStatus>(`/patients/${patientId}/journey`),
  })
  const { data: timeline } = useQuery({
    queryKey: ['patient-timeline', patientId],
    queryFn: () =>
      apiRequest<{
        events: { type: string; occurredAt: string; title: string; summary: string }[]
      }>(`/patients/${patientId}/timeline`),
  })
  const { data: encounters = [], isError: encountersError } = useQuery({
    queryKey: ['patient-encounters', patientId],
    queryFn: () => apiRequest<EncounterRow[]>(`/opd/encounters?patientId=${patientId}`),
    enabled: tab === 'visits',
    retry: false,
  })
  const { data: payments = [] } = useQuery({
    queryKey: ['patient-payments', patientId],
    queryFn: () => listPatientPayments(patientId),
    enabled: tab === 'overview',
  })
  const { data: documents = [], isError: documentsError } = useQuery({
    queryKey: ['patient-documents', patientId],
    queryFn: () => listPatientDocuments(patientId),
    enabled: tab === 'documents',
    retry: false,
  })

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (editing) setEditing(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, editing])

  const events = timeline?.events ?? []
  const age = patient ? calcAge(patient.dateOfBirth) : 0
  const statusLabel = journey?.encounterStatus
    ? journey.encounterStatus.replace(/_/g, ' ')
    : journey?.step
      ? journey.step.replace(/_/g, ' ')
      : 'Registered'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-file-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 bg-slate-900 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-400">Patient file</p>
            <h2 id="patient-file-title" className="truncate text-xl font-bold text-white">
              {patient ? formatPatientName(patient) : 'Loading…'}
            </h2>
            {patient ? (
              <p className="mt-1 text-sm text-slate-300">
                {patient.patientNo} · {age} yrs · {patient.gender} · {patient.primaryPhone || 'No phone'}
              </p>
            ) : null}
            <p className="mt-2 inline-flex rounded-full bg-teal-500/15 px-2.5 py-1 text-xs font-semibold capitalize text-teal-200">
              {statusLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {patient && !editing ? (
              <>
                {canEditPatient ? (
                  <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
                    <UserRoundPen className="h-4 w-4" />
                    Edit Patient
                  </Button>
                ) : null}
                {onQuickCheckIn ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      onQuickCheckIn({
                        id: patient.id,
                        patientNo: patient.patientNo,
                        firstName: patient.firstName,
                        lastName: patient.lastName,
                        dateOfBirth: patient.dateOfBirth,
                        gender: patient.gender,
                        primaryPhone: patient.primaryPhone,
                      })
                    }
                  >
                    <Stethoscope className="h-4 w-4" />
                    Quick Check-In
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={printing}
                  onClick={async () => {
                    setPrinting(true)
                    try {
                      await printPatientCard(patientId, catalog)
                    } catch (error) {
                      notify(
                        'Print failed',
                        error instanceof Error ? error.message : 'Could not prepare card.',
                        'critical',
                      )
                    } finally {
                      setPrinting(false)
                    }
                  }}
                >
                  <Printer className="h-4 w-4" />
                  {printing ? 'Preparing…' : 'Print Patient Card'}
                </Button>
              </>
            ) : null}
            <Button type="button" variant="ghost" className="text-slate-200 hover:bg-slate-800" onClick={onClose}>
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>
        </div>

        {!editing ? (
          <div className="flex gap-2 overflow-x-auto border-b border-slate-800 bg-slate-900/80 px-5 py-2 sm:px-6">
            {(
              [
                ['overview', 'Overview'],
                ['demographics', 'Demographics'],
                ['visits', 'Visits'],
                ['history', 'History'],
                ['documents', 'Documents'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={
                  tab === id
                    ? 'rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white'
                    : 'rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-slate-800'
                }
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-5 py-5 sm:px-6">
          {isLoading || !patient ? (
            <p className="text-slate-500">Loading patient file…</p>
          ) : editing ? (
            <PatientRegistrationForm
              editPatient={patient}
              onEditComplete={async () => {
                setEditing(false)
                await queryClient.invalidateQueries({ queryKey: ['patient', patientId] })
                await queryClient.invalidateQueries({ queryKey: ['patient-timeline', patientId] })
              }}
              onCancelEdit={() => setEditing(false)}
            />
          ) : (
            <>
              {tab === 'overview' ? (
                <div className="space-y-6">
                  {age < 18 ? (
                    <Alert tone="info" title="Minor patient">
                      This file is the child. Guardian details stay on this record — do not register the
                      guardian as a second patient.
                    </Alert>
                  ) : null}
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="p-4">
                      <p className="text-xs font-bold uppercase text-slate-500">Identity</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <ReadOnlyField label="Name" value={formatPatientName(patient)} />
                        <ReadOnlyField label="MRN" value={patient.patientNo} />
                        <ReadOnlyField label="Age / DOB" value={`${age} yrs · ${patient.dateOfBirth?.slice(0, 10) || '—'}`} />
                        <ReadOnlyField label="Sex" value={patient.gender} />
                        <ReadOnlyField label="Phone" value={patient.primaryPhone} />
                        <ReadOnlyField
                          label="Registered"
                          value={patient.createdAt ? new Date(patient.createdAt).toLocaleString() : '—'}
                        />
                      </div>
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs font-bold uppercase text-slate-500">
                        {age < 18 ? 'Guardian / next of kin' : 'Next of kin'}
                      </p>
                      {patient.nextOfKin?.length ? (
                        patient.nextOfKin.map((row) => (
                          <p key={`${row.name}-${row.primaryPhone}`} className="mt-2 text-sm">
                            {row.name} ({row.relationship}) · {row.primaryPhone}
                            {row.isEmergencyContact ? ' · emergency' : ''}
                          </p>
                        ))
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">
                          {age < 18
                            ? 'No guardian recorded. Use Edit Patient / Records — do not create another patient.'
                            : 'None recorded'}
                        </p>
                      )}
                    </Card>
                    <Card className="border-red-100 p-4">
                      <p className="text-xs font-bold uppercase text-red-700">Allergies / alerts</p>
                      {patient.allergies?.length ? (
                        patient.allergies.map((row) => (
                          <p key={row.allergen} className="mt-2 text-sm font-medium text-red-800">
                            {row.allergen} · {row.severity}
                          </p>
                        ))
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">None recorded</p>
                      )}
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs font-bold uppercase text-slate-500">Recent cashier records</p>
                      {payments.length ? (
                        payments.slice(0, 3).map((row) => (
                          <p key={row.id} className="mt-2 text-sm">
                            {row.serviceDescription || row.serviceLine || 'Payment'} · {formatKes(row.amount)}
                          </p>
                        ))
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">None on file</p>
                      )}
                    </Card>
                  </div>
                </div>
              ) : null}

              {tab === 'demographics' ? (
                <section>
                  <PageHeader title="Demographics" description="Read-only here. Use Edit Patient to change these details. Clinical history is not changed by a demographic edit." />
                  <Card className="mt-3 p-5">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <ReadOnlyField label="Patient name" value={formatPatientName(patient)} />
                      <ReadOnlyField label="MRN / Patient number" value={patient.patientNo} />
                      <ReadOnlyField label="Age / DOB" value={`${age} yrs · ${patient.dateOfBirth?.slice(0, 10) || '—'}`} />
                      <ReadOnlyField label="Sex" value={patient.gender} />
                      <ReadOnlyField label="Phone" value={patient.primaryPhone} />
                      <ReadOnlyField label="Alternative phone" value={patient.secondaryPhone} />
                      <ReadOnlyField label="Email" value={patient.email} />
                      <ReadOnlyField label="Blood group" value={patient.bloodGroup} />
                      <ReadOnlyField label="Nationality" value={patient.nationality} />
                      <ReadOnlyField label="Marital status" value={patient.maritalStatus} />
                      <ReadOnlyField label="Occupation" value={patient.occupation} />
                      <ReadOnlyField label="Religion" value={patient.religion} />
                      <ReadOnlyField label="County" value={patient.county} />
                      <ReadOnlyField label="Sub county" value={patient.subCounty} />
                      <ReadOnlyField
                        label="Registered"
                        value={patient.createdAt ? new Date(patient.createdAt).toLocaleString() : '—'}
                      />
                    </div>
                  </Card>
                  <Card className="mt-4 p-4">
                    <p className="text-xs font-bold uppercase text-slate-500">Identifiers</p>
                    {patient.identifiers?.length ? (
                      patient.identifiers.map((row) => (
                        <p key={`${row.type}-${row.value}`} className="mt-2 text-sm">
                          {row.type.replace(/_/g, ' ')}: {row.value}
                        </p>
                      ))
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">None recorded</p>
                    )}
                  </Card>
                </section>
              ) : null}

              {tab === 'visits' ? (
                <Card className="p-5">
                  <PageHeader title="Encounters / visits" description="Existing OPD visits for this patient. Newest first." />
                  {encountersError ? (
                    <Alert tone="info">Visits are unavailable for this account.</Alert>
                  ) : encounters.length ? (
                    <div className="divide-y divide-slate-100">
                      {encounters.map((row) => (
                        <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                          <div>
                            <p className="font-semibold">{row.encounterNo || row.id}</p>
                            <p className="text-xs text-slate-500">
                              {row.departmentName || 'OPD'} · {row.visitType || 'visit'} ·{' '}
                              {new Date(row.startedAt).toLocaleString()}
                            </p>
                          </div>
                          <p className="text-sm font-medium capitalize text-slate-700">
                            {row.status.replace(/_/g, ' ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Alert tone="info">No OPD encounters on file yet.</Alert>
                  )}
                </Card>
              ) : null}

              {tab === 'history' ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="border-red-100 p-4">
                      <p className="text-xs font-bold uppercase text-red-700">Allergies / alerts</p>
                      {patient.allergies?.length ? (
                        patient.allergies.map((row) => (
                          <p key={row.allergen} className="mt-2 text-sm font-medium text-red-800">
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
                  <PatientTimeline
                    events={events}
                    title="Clinical timeline"
                    description="Existing encounters, investigations, admissions, and documents — nothing is invented here."
                  />
                </div>
              ) : null}

              {tab === 'documents' ? (
                <Card className="p-5">
                  <PageHeader
                    title="Documents"
                    description="Existing clinical documents for this patient. Nothing is created by opening this file."
                  />
                  {documentsError ? (
                    <Alert tone="info">Documents are unavailable for this account.</Alert>
                  ) : documents.length ? (
                    <div className="divide-y divide-slate-100">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                          <div>
                            <p className="font-semibold">{doc.title}</p>
                            <p className="text-xs text-slate-500">
                              {doc.documentType.replace(/_/g, ' ')} · {doc.filename} ·{' '}
                              {new Date(doc.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Alert tone="info">No documents attached yet.</Alert>
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

function ReadOnlyField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value?.toString().trim() || '—'}</p>
    </div>
  )
}
