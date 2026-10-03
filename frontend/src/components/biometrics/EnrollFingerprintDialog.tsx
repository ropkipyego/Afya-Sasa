import { useEffect, useState } from 'react'
import { Alert, Button, Card } from '../ui'
import { apiRequest, formatApiError, getApiErrorStatus } from '../../lib/api'
import {
  biometricDeviceStatus,
  captureFingerprint,
  readerStateLabel,
  type BiometricReaderState,
} from '../../lib/biometric-agent'
import { BIOMETRIC_FINGERS, fingerLabel } from './biometric-fingers'

type Phase =
  | 'idle'
  | 'device_checking'
  | 'ready'
  | 'capturing'
  | 'processing'
  | 'success'
  | 'duplicate'
  | 'conflict'
  | 'device_disconnected'
  | 'sdk_unavailable'
  | 'network_error'
  | 'authorization_error'
  | 'error'

export function EnrollFingerprintDialog({
  patient,
  onClose,
  onEnrolled,
}: {
  patient: { id: string; patientNo: string; firstName: string; lastName: string }
  onClose: () => void
  onEnrolled?: () => void
}) {
  const [finger, setFinger] = useState('right_index')
  const [phase, setPhase] = useState<Phase>('device_checking')
  const [reader, setReader] = useState<BiometricReaderState>('AGENT_UNREACHABLE')
  const [message, setMessage] = useState('Checking the DigitalPersona reader…')
  const [quality, setQuality] = useState<string | null>(null)

  const refreshDevice = async () => {
    setPhase('device_checking')
    const status = await biometricDeviceStatus()
    setReader(status.sdk)
    if (status.sdk === 'DEVICE_READY') {
      setPhase('ready')
      setMessage('Place the selected finger on the reader when ready.')
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
      setMessage(status.lastError || 'Cannot contact the local biometric agent.')
      return
    }
    setPhase('error')
    setMessage(status.lastError || 'Fingerprint reader is not ready.')
  }

  useEffect(() => {
    void refreshDevice()
  }, [])

  const enroll = async () => {
    setPhase('capturing')
    setMessage('Place finger on reader…')
    setQuality(null)
    try {
      const capture = await captureFingerprint('enroll', finger)
      setPhase('processing')
      setMessage('Linking the fingerprint to this existing patient…')
      if (capture.qualityLabel) setQuality(capture.qualityLabel)
      const result = await apiRequest<{
        result: string
        patientId: string
        identityId: string
        qualityLabel?: string | null
      }>('/biometrics/enroll', {
        method: 'POST',
        body: JSON.stringify({ patientId: patient.id, fingerPosition: finger, capture }),
      })
      setQuality(result.qualityLabel ?? capture.qualityLabel ?? null)
      setPhase('success')
      setMessage('Enrollment successful. This is a local Jalaram identity, not DHA consent.')
      onEnrolled?.()
    } catch (error) {
      const status = getApiErrorStatus(error)
      const text = formatApiError(error, 'Fingerprint enrollment was not completed.')
      if (status === 403) {
        setPhase('authorization_error')
        setMessage('You do not have permission to enroll a fingerprint.')
        return
      }
      if (status === 409 || /already registered/i.test(text)) {
        setPhase('conflict')
        setMessage('This fingerprint is already registered to another patient.')
        return
      }
      if (/SDK_UNAVAILABLE|SDK is not available/i.test(text)) {
        setPhase('sdk_unavailable')
        setMessage(text)
        return
      }
      if (/unavailable|DISCONNECTED/i.test(text)) {
        setPhase('device_disconnected')
        setMessage(text)
        return
      }
      setPhase('error')
      setMessage(text)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
      <Card className="w-full max-w-lg space-y-4 p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Enroll fingerprint</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">
            {patient.patientNo} · {patient.firstName} {patient.lastName}
          </h2>
          <p className="text-sm text-slate-500">The patient already exists. Enrollment will not create another record.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <p className="font-semibold text-slate-800">DigitalPersona 4500</p>
          <p className="mt-1 text-slate-600">
            ● {readerStateLabel(reader)}
          </p>
        </div>
        <label className="block text-sm">
          <span className="font-semibold text-slate-700">Finger</span>
          <select
            className="input mt-1 w-full"
            value={finger}
            onChange={(event) => setFinger(event.target.value)}
            disabled={phase === 'capturing' || phase === 'processing'}
          >
            {BIOMETRIC_FINGERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {quality ? <p className="text-sm text-slate-600">Fingerprint quality: {quality}</p> : null}
        <Alert
          tone={
            phase === 'success'
              ? 'success'
              : phase === 'conflict' || phase === 'error' || phase === 'authorization_error'
                ? 'error'
                : 'info'
          }
        >
          {message}
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void enroll()}
            loading={phase === 'capturing' || phase === 'processing'}
            disabled={phase === 'capturing' || phase === 'processing' || phase === 'success'}
          >
            Capture {fingerLabel(finger)}
          </Button>
          <Button type="button" variant="secondary" onClick={() => void refreshDevice()}>
            Recheck reader
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {phase === 'success' ? 'Done' : 'Skip for now'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
