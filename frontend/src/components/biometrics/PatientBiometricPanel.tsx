import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card } from '../ui'
import { apiRequest, formatApiError } from '../../lib/api'
import { captureFingerprint } from '../../lib/biometric-agent'
import { notify } from '../../lib/notify'
import { useAuthStore } from '../../lib/auth-store'
import { EnrollFingerprintDialog } from './EnrollFingerprintDialog'
import { fingerLabel } from './biometric-fingers'

type IdentityRow = {
  id: string
  fingerPosition: string | null
  status: string
  createdAt: string
}

export function PatientBiometricPanel({
  patient,
}: {
  patient: { id: string; patientNo: string; firstName: string; lastName: string }
}) {
  const queryClient = useQueryClient()
  const canUnlink = useAuthStore((state) => (state.user?.permissions ?? []).includes('settings:manage'))
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [confirmUnlink, setConfirmUnlink] = useState<IdentityRow | null>(null)
  const [verifying, setVerifying] = useState(false)

  const { data, isError, error, refetch } = useQuery({
    queryKey: ['biometric-identities', patient.id],
    queryFn: () =>
      apiRequest<{ identities: IdentityRow[] }>(`/biometrics/patients/${patient.id}/identities`),
  })

  const unlink = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/biometrics/identities/${id}/unlink`, { method: 'POST' }),
    onSuccess: () => {
      notify('Fingerprint unlinked', 'The patient record and history were not deleted.', 'success')
      setConfirmUnlink(null)
      void queryClient.invalidateQueries({ queryKey: ['biometric-identities', patient.id] })
    },
    onError: (err: Error) => notify('Unlink failed', formatApiError(err, 'Could not unlink the fingerprint.'), 'critical'),
  })

  const verify = async () => {
    setVerifying(true)
    try {
      const capture = await captureFingerprint('verify')
      const result = await apiRequest<{ matched?: boolean; message?: string }>('/biometrics/verify', {
        method: 'POST',
        body: JSON.stringify({ patientId: patient.id, capture }),
      })
      notify(
        result.matched ? 'Fingerprint verified' : 'Fingerprint does not match this patient.',
        result.message || (result.matched ? '1:1 verification succeeded.' : 'This is not a 1:N identification.'),
        result.matched ? 'success' : 'warning',
      )
    } catch (err) {
      notify('Verification failed', formatApiError(err, 'Could not verify this patient.'), 'warning')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-xs font-bold uppercase text-slate-500">Fingerprint identities</p>
        <p className="mt-1 text-sm text-slate-600">
          Local DigitalPersona identities for {patient.patientNo}. Templates never appear in this browser.
        </p>
        <div className="mt-3 space-y-2">
          {(data?.identities ?? []).map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <div>
                <p className="font-semibold text-slate-800">{fingerLabel(row.fingerPosition)}</p>
                <p className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()}</p>
              </div>
              {canUnlink ? (
                <Button type="button" variant="secondary" onClick={() => setConfirmUnlink(row)}>
                  Unlink
                </Button>
              ) : null}
            </div>
          ))}
          {!data?.identities?.length ? <p className="text-sm text-slate-500">Not enrolled.</p> : null}
        </div>
        {isError ? <Alert tone="error">{formatApiError(error, 'Unable to load fingerprint identities.')}</Alert> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => setEnrollOpen(true)}>
            Enroll fingerprint
          </Button>
          <Button type="button" variant="secondary" loading={verifying} onClick={() => void verify()}>
            Verify fingerprint
          </Button>
          <Button type="button" variant="ghost" onClick={() => void refetch()}>
            Refresh
          </Button>
        </div>
      </Card>
      {confirmUnlink ? (
        <Alert tone="warning">
          <p className="font-semibold">You are removing the fingerprint identity from:</p>
          <p>
            {patient.patientNo} {patient.firstName} {patient.lastName} ({fingerLabel(confirmUnlink.fingerPosition)})
          </p>
          <p className="mt-1 text-xs">The patient and clinical history stay. Only the biometric link is removed.</p>
          <div className="mt-3 flex gap-2">
            <Button type="button" onClick={() => unlink.mutate(confirmUnlink.id)} loading={unlink.isPending}>
              Confirm unlink
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirmUnlink(null)}>
              Cancel
            </Button>
          </div>
        </Alert>
      ) : null}
      {enrollOpen ? (
        <EnrollFingerprintDialog
          patient={patient}
          onClose={() => setEnrollOpen(false)}
          onEnrolled={() => void queryClient.invalidateQueries({ queryKey: ['biometric-identities', patient.id] })}
        />
      ) : null}
    </div>
  )
}
