import { useState } from 'react'
import { Button } from '../ui'
import { apiRequest, formatApiError } from '../../lib/api'
import { captureFingerprint } from '../../lib/biometric-agent'
import { notify } from '../../lib/notify'
import { EnrollFingerprintDialog } from './EnrollFingerprintDialog'

type IdentifyHit = {
  id: string
  patientNo: string
  firstName: string
  lastName: string
}

export function BiometricIdentifyButton({
  onMatch,
}: {
  onMatch: (patient: IdentifyHit) => void
}) {
  const [pending, setPending] = useState(false)
  return (
    <Button
      type="button"
      variant="secondary"
      loading={pending}
      onClick={async () => {
        setPending(true)
        try {
          const capture = await captureFingerprint('identify')
          const result = await apiRequest<{
            result: string
            patients: IdentifyHit[]
            message?: string
          }>('/biometrics/identify', {
            method: 'POST',
            body: JSON.stringify({ capture }),
          })
          if (result.result === 'verified' && result.patients.length === 1) {
            onMatch(result.patients[0])
            notify('Patient identified', `${result.patients[0].patientNo} ${result.patients[0].firstName} ${result.patients[0].lastName}`, 'success')
            return
          }
          if (result.result === 'multiple_candidates') {
            notify('Ambiguous fingerprint', result.message || 'Confirm identity manually. No patient was selected.', 'warning')
            return
          }
          notify('Patient fingerprint not recognized', 'Try again or search the patient manually.', 'warning')
        } catch (error) {
          notify(
            'Fingerprint unavailable',
            formatApiError(error, 'Use patient number or national ID.'),
            'warning',
          )
        } finally {
          setPending(false)
        }
      }}
    >
      Identify by fingerprint
    </Button>
  )
}

export function BiometricEnrollButton({
  patient,
}: {
  patient: { id: string; patientNo?: string; firstName?: string; lastName?: string }
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Enroll fingerprint
      </Button>
      {open ? (
        <EnrollFingerprintDialog
          patient={{
            id: patient.id,
            patientNo: patient.patientNo ?? 'Patient',
            firstName: patient.firstName ?? '',
            lastName: patient.lastName ?? '',
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

export type { IdentifyHit }
