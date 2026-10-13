import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, PageHeader, Alert, Button } from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { ShaEligibilityCard } from '../sha/ShaEligibilityCard'
import { apiRequest, formatApiError } from '../../lib/api'
import { listPatientCharges } from '../../lib/payments'
import { notify } from '../../lib/notify'
import { useAuthStore } from '../../lib/auth-store'
import { getShaStatus } from '../../lib/sha'

type Workspace = {
  payers: Array<{ id: string; type: string; name: string; active: boolean; notes: string }>
  claims: Array<{
    id: string
    patientId: string
    payerId: string
    status: string
    totalCharge: number
    approvedAmount: number | null
    amountReceived: number
    externalReference: string | null
    cashEquivalent: boolean
    split: { guaranteedReceivable: boolean; remainingPatientBalance: number }
  }>
  eligibility: Array<{ id: string; outcome: string; source: string; createdAt: string }>
  notes: string[]
}

export function InsuranceWorkspace() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? [])
  const canManage = permissions.includes('payments:manage') || permissions.includes('settings:manage')
  const queryClient = useQueryClient()
  const [patient, setPatient] = useState<PatientSearchItem | null>(null)
  const [payerId, setPayerId] = useState('')
  const [selectedCharges, setSelectedCharges] = useState<string[]>([])

  const workspace = useQuery({
    queryKey: ['insurance-workspace'],
    queryFn: () => apiRequest<Workspace>('/insurance/workspace'),
  })
  const sha = useQuery({ queryKey: ['sha-status'], queryFn: getShaStatus, staleTime: 60_000 })
  const charges = useQuery({
    queryKey: ['patient-charges', patient?.id],
    queryFn: () => listPatientCharges(patient!.id),
    enabled: Boolean(patient?.id),
  })

  const prepare = useMutation({
    mutationFn: () =>
      apiRequest('/insurance/claims', {
        method: 'POST',
        body: JSON.stringify({ patientId: patient?.id, payerId, chargeIds: selectedCharges }),
      }),
    onSuccess: () => {
      notify('Claim draft saved', 'This is not a SHA submission.', 'success')
      setSelectedCharges([])
      void queryClient.invalidateQueries({ queryKey: ['insurance-workspace'] })
    },
    onError: (error: Error) => notify('Could not draft claim', formatApiError(error, 'Could not save the draft.'), 'critical'),
  })

  return (
    <div className="workspace-shell animate-fade-in space-y-6">
      <Card className="p-6">
        <PageHeader
          title="Insurance & claims"
          description="Payer configuration, SHA eligibility, and operational drafts. A drafted or approved claim is not cash received."
        />
        <p className="mt-3 text-sm text-slate-600">
          SHA HIE: {sha.data?.mode ?? '…'}
          {sha.data?.connected ? ' · eligibility reachable' : ' · eligibility not connected'}. Claims stay on{' '}
          <a className="font-semibold underline" href="https://portal.sha.go.ke" target="_blank" rel="noreferrer">
            portal.sha.go.ke
          </a>
          .
        </p>
      </Card>

      {workspace.data?.notes?.map((note) => (
        <Alert key={note} tone="info">
          {note}
        </Alert>
      ))}

      <Card className="space-y-3 p-6">
        <h3 className="text-sm font-bold text-slate-800">Configured payers</h3>
        <ul className="space-y-2 text-sm">
          {(workspace.data?.payers ?? []).map((payer) => (
            <li key={payer.id} className="rounded-xl border border-slate-200 px-4 py-3">
              <p className="font-semibold">{payer.name}</p>
              <p className="text-xs text-slate-500">
                {payer.type} · {payer.active ? 'active' : 'inactive'}
              </p>
              <p className="mt-1 text-slate-600">{payer.notes}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-4 p-6">
        <h3 className="text-sm font-bold text-slate-800">Prepare a claim draft from existing charges</h3>
        <PatientSearchAutocomplete selected={patient} onSelect={setPatient} />
        {patient ? <ShaEligibilityCard patientId={patient.id} /> : null}
        {patient ? (
          <>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-700">Payer</span>
              <select className="input" value={payerId} onChange={(event) => setPayerId(event.target.value)}>
                <option value="">Select payer</option>
                {(workspace.data?.payers ?? [])
                  .filter((payer) => payer.active && payer.type !== 'self_pay')
                  .map((payer) => (
                    <option key={payer.id} value={payer.id}>
                      {payer.name}
                    </option>
                  ))}
              </select>
            </label>
            <ul className="space-y-2 text-sm">
              {(charges.data ?? []).map((row) => (
                <li key={row.id}>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedCharges.includes(row.id)}
                      onChange={(event) =>
                        setSelectedCharges((current) =>
                          event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id),
                        )
                      }
                    />
                    {row.serviceDescription} · {row.status}
                  </label>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              disabled={!canManage || !payerId || !selectedCharges.length}
              loading={prepare.isPending}
              onClick={() => prepare.mutate()}
            >
              Save operational draft
            </Button>
          </>
        ) : null}
      </Card>

      <Card className="space-y-3 p-6">
        <h3 className="text-sm font-bold text-slate-800">Claim drafts</h3>
        {(workspace.data?.claims ?? []).length ? (
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Status</th>
                <th>Charge total</th>
                <th>Received</th>
                <th>Portal ref</th>
                <th>Cash?</th>
              </tr>
            </thead>
            <tbody>
              {workspace.data!.claims.map((claim) => (
                <tr key={claim.id} className="border-t border-slate-100">
                  <td className="py-2">{claim.status}</td>
                  <td>{claim.totalCharge}</td>
                  <td>{claim.amountReceived}</td>
                  <td>{claim.externalReference ?? '—'}</td>
                  <td>{claim.cashEquivalent ? 'Remittance recorded' : 'Not cash'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-500">No operational drafts yet.</p>
        )}
      </Card>
    </div>
  )
}
