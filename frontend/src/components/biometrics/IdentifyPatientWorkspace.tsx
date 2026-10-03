import { useEffect, useState } from 'react'
import { Alert, Button, Card, PageHeader } from '../ui'
import { apiRequest, formatApiError } from '../../lib/api'
import {
  biometricDeviceStatus,
  captureFingerprint,
  readerStateLabel,
  type BiometricReaderState,
} from '../../lib/biometric-agent'
import { openPatientFile } from '../../lib/patient-file'
import { PatientSearchBrowse } from '../PatientSearchAutocomplete'

type IdentifiedPatient = {
  id: string
  patientNo: string
  firstName: string
  middleName?: string | null
  lastName: string
  dateOfBirth: string
  gender: string
  primaryPhone?: string
  createdAt?: string
  photoUrl?: string | null
}

type IdentifyContext = {
  currentEncounter: { id: string; status: string; type: string; startedAt: string } | null
  lastVisitAt: string | null
  currentAdmission: { id: string; status: string; admittedAt: string } | null
  upcomingAppointment?: { id: string; status: string; date: string; time: string; type: string } | null
  alerts?: { kind: string; label: string; severity: string }[]
}

type Phase =
  | 'idle'
  | 'device_checking'
  | 'ready'
  | 'capturing'
  | 'processing'
  | 'success'
  | 'no_match'
  | 'ambiguous'
  | 'device_disconnected'
  | 'sdk_unavailable'
  | 'network_error'
  | 'error'

export function IdentifyPatientWorkspace({
  onOpenPatient,
  onStartEncounter,
  onAppointments,
  onIdentified,
}: {
  onOpenPatient?: (patientId: string) => void
  onStartEncounter?: (patient: IdentifiedPatient) => void
  onAppointments?: (patientId: string) => void
  onIdentified?: (patient: IdentifiedPatient) => void
}) {
  const [phase, setPhase] = useState<Phase>('device_checking')
  const [reader, setReader] = useState<BiometricReaderState>('AGENT_UNREACHABLE')
  const [message, setMessage] = useState('Checking the DigitalPersona reader…')
  const [match, setMatch] = useState<IdentifiedPatient | null>(null)
  const [context, setContext] = useState<IdentifyContext | null>(null)
  const [manual, setManual] = useState(false)

  const refreshDevice = async () => {
    setPhase('device_checking')
    setMatch(null)
    setContext(null)
    const status = await biometricDeviceStatus()
    setReader(status.sdk)
    if (status.sdk === 'DEVICE_READY') {
      setPhase('ready')
      setMessage('Place a finger on the reader to identify an existing patient.')
      return
    }
    if (status.sdk === 'SDK_UNAVAILABLE') {
      setPhase('sdk_unavailable')
      setMessage('DigitalPersona SDK is not available on this workstation.')
      return
    }
    if (status.sdk === 'DEVICE_DISCONNECTED') {
      setPhase('device_disconnected')
      setMessage('Fingerprint reader unavailable. Use manual patient search.')
      return
    }
    if (status.sdk === 'AGENT_UNREACHABLE') {
      setPhase('network_error')
      setMessage(status.lastError || 'Cannot contact AfyaSasa biometric agent. Check the workstation.')
      return
    }
    setPhase('error')
    setMessage(status.lastError || 'Fingerprint reader is not ready.')
  }

  useEffect(() => {
    void refreshDevice()
  }, [])

  const identify = async () => {
    setPhase('capturing')
    setMessage('Place finger on reader…')
    setMatch(null)
    setContext(null)
    try {
      const capture = await captureFingerprint('identify')
      setPhase('processing')
      const result = await apiRequest<{
        result: string
        patients: IdentifiedPatient[]
        context: IdentifyContext | null
        message?: string
      }>('/biometrics/identify', {
        method: 'POST',
        body: JSON.stringify({ capture }),
      })
      if (result.result === 'verified' && result.patients.length === 1) {
        setMatch(result.patients[0])
        setContext(result.context)
        setPhase('success')
        setMessage('THIS IS THE PATIENT THAT WAS IDENTIFIED.')
        onIdentified?.(result.patients[0])
        return
      }
      if (result.result === 'multiple_candidates') {
        setPhase('ambiguous')
        setMessage(
          result.message ||
            'Multiple biometric candidates were returned. Confirm identity with another factor. No patient was selected.',
        )
        return
      }
      setPhase('no_match')
      setMessage('Patient fingerprint not recognized.')
    } catch (error) {
      const text = formatApiError(error, 'Fingerprint identification was not completed.')
      if (/SDK_UNAVAILABLE|SDK is not available/i.test(text)) {
        setPhase('sdk_unavailable')
      } else if (/unavailable|DISCONNECTED/i.test(text)) {
        setPhase('device_disconnected')
      } else {
        setPhase('error')
      }
      setMessage(text)
    }
  }

  const open = (patientId: string) => {
    if (onOpenPatient) onOpenPatient(patientId)
    else openPatientFile(patientId)
  }

  return (
    <div className="workspace-shell animate-fade-in space-y-6">
      <PageHeader
        title="Identify patient"
        description="Fingerprint identification finds the existing Patient ID. It does not create a patient and is not DHA consent."
      />
      <Card className="space-y-4 p-6">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-bold uppercase text-slate-500">DigitalPersona 4500</p>
          <p className="mt-1 font-semibold text-slate-900">● {readerStateLabel(reader)}</p>
        </div>
        <Alert
          tone={
            phase === 'success'
              ? 'success'
              : phase === 'no_match' || phase === 'ambiguous' || phase === 'error'
                ? 'warning'
                : 'info'
          }
        >
          {message}
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void identify()}
            loading={phase === 'capturing' || phase === 'processing'}
            disabled={phase === 'capturing' || phase === 'processing'}
          >
            Identify by fingerprint
          </Button>
          <Button type="button" variant="secondary" onClick={() => void refreshDevice()}>
            Recheck reader
          </Button>
          <Button type="button" variant="ghost" onClick={() => setManual(true)}>
            Search patient manually
          </Button>
        </div>
      </Card>

      {match ? (
        <Card className="space-y-4 border-teal-200 bg-teal-50 p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-teal-800">Patient identified</p>
          <div className="flex flex-wrap items-start gap-4">
            {match.photoUrl ? (
              <img
                src={match.photoUrl}
                alt={`${match.firstName} ${match.lastName}`}
                className="h-20 w-20 rounded-xl object-cover"
              />
            ) : null}
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {match.patientNo} · {match.firstName} {match.lastName}
              </h2>
              <p className="text-sm text-slate-700">
                DOB {match.dateOfBirth?.slice(0, 10) || '—'} · {match.gender}
                {match.primaryPhone ? ` · ${match.primaryPhone}` : ''}
              </p>
              {match.createdAt ? (
                <p className="text-xs text-slate-500">
                  Registered {new Date(match.createdAt).toLocaleDateString()}
                </p>
              ) : null}
            </div>
          </div>
          {context?.alerts?.length ? (
            <Alert tone="warning">
              Allergies:{' '}
              {context.alerts.map((row) => `${row.label} (${row.severity})`).join(', ')}
            </Alert>
          ) : null}
          <div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700">
            <p>
              Current status:{' '}
              {context?.currentEncounter
                ? `Open ${context.currentEncounter.type} visit (${context.currentEncounter.status.replace(/_/g, ' ')})`
                : 'No open encounter'}
            </p>
            <p>
              Admission:{' '}
              {context?.currentAdmission ? 'Active inpatient admission' : 'No active admission'}
            </p>
            <p>
              Appointment:{' '}
              {context?.upcomingAppointment
                ? `${context.upcomingAppointment.date} ${context.upcomingAppointment.time} (${context.upcomingAppointment.status})`
                : 'No upcoming appointment'}
            </p>
            <p>
              Last visit:{' '}
              {context?.lastVisitAt ? new Date(context.lastVisitAt).toLocaleDateString() : 'None recorded'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => open(match.id)}>
              Open patient
            </Button>
            {onStartEncounter ? (
              <Button type="button" variant="secondary" onClick={() => onStartEncounter(match)}>
                Start encounter
              </Button>
            ) : null}
            {onAppointments ? (
              <Button type="button" variant="secondary" onClick={() => onAppointments(match.id)}>
                Appointments
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => window.dispatchEvent(new CustomEvent('afyasasa:navigate', { detail: 'Appointments' }))}
              >
                Appointments
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => open(match.id)}>
              Patient history
            </Button>
            <Button type="button" variant="ghost" onClick={() => void identify()}>
              Change patient
            </Button>
          </div>
        </Card>
      ) : null}

      {manual || phase === 'no_match' || phase === 'sdk_unavailable' || phase === 'device_disconnected' ? (
        <Card className="p-6">
          <h3 className="font-bold text-slate-900">Manual patient search</h3>
          <p className="mt-1 text-sm text-slate-600">
            Biometric failure must not block care. Search by patient number or name.
          </p>
          <div className="mt-4">
            <PatientSearchBrowse
              onSelect={(patient) => {
                open(patient.id)
              }}
            />
          </div>
        </Card>
      ) : null}
    </div>
  )
}
