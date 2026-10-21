import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, PageHeader, Alert, Button, Field } from '../ui'
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
    allowedTransitions: string[]
    split: { guaranteedReceivable: boolean; remainingPatientBalance: number }
    history?: Array<{ at: string; from: string | null; to: string; actor: string | null; reason?: string | null }>
  }>
  eligibility: Array<{
    id: string
    outcome: string
    source: string
    verificationKind?: string
    createdAt: string
  }>
  notes: string[]
}

const ELIGIBILITY_KIND_LABEL: Record<string, string> = {
  verified_insurer_response: 'Verified insurer response (live SHA HIE)',
  practice_mode_not_live: 'Practice / stub — not a live insurer response',
  recorded_without_insurer_response: 'Manually recorded — not verified by the insurer',
}

function isRemittance(status: string) {
  return status === 'partially_paid' || status === 'settled'
}

export function InsuranceWorkspace() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? [])
  const canPrepare =
    permissions.includes('payments:read') ||
    permissions.includes('payments:initiate') ||
    permissions.includes('payments:manage')
  const canRemit = permissions.includes('payments:manage')
  const canAdminPayers = permissions.includes('payments:manage') || permissions.includes('settings:manage')
  const queryClient = useQueryClient()
  const [patient, setPatient] = useState<PatientSearchItem | null>(null)
  const [payerId, setPayerId] = useState('')
  const [selectedCharges, setSelectedCharges] = useState<string[]>([])
  const [transition, setTransition] = useState<Record<string, { status: string; reason: string; externalReference: string }>>(
    {},
  )

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

  const changeStatus = useMutation({
    mutationFn: (input: { id: string; status: string; reason: string; externalReference: string }) =>
      apiRequest(`/insurance/claims/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: input.status,
          reason: input.reason,
          externalReference: input.externalReference || undefined,
        }),
      }),
    onSuccess: () => {
      notify('Claim status updated', 'Remittance statuses do not post cashier payments.', 'success')
      void queryClient.invalidateQueries({ queryKey: ['insurance-workspace'] })
    },
    onError: (error: Error) => notify('Could not update claim', formatApiError(error, 'Status change failed.'), 'critical'),
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
          . Live SHA/DHA claim posting is not connected.
        </p>
        {canAdminPayers ? (
          <p className="mt-2 text-xs text-slate-500">You can maintain payers. Claims officers cannot edit the payer catalogue.</p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            You can draft claims and record portal numbers. Recording remittance needs finance (payments:manage).
          </p>
        )}
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
              {(charges.data ?? []).map((row) => {
                const cancelled = row.status === 'cancelled'
                return (
                  <li key={row.id}>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        disabled={cancelled}
                        checked={selectedCharges.includes(row.id)}
                        onChange={(event) =>
                          setSelectedCharges((current) =>
                            event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id),
                          )
                        }
                      />
                      {row.serviceDescription} · {row.status}
                      {cancelled ? ' · cannot claim' : ''}
                    </label>
                  </li>
                )
              })}
            </ul>
            <Button
              type="button"
              disabled={!canPrepare || !payerId || !selectedCharges.length}
              loading={prepare.isPending}
              onClick={() => prepare.mutate()}
            >
              Save operational draft
            </Button>
          </>
        ) : null}
      </Card>

      <Card className="space-y-3 p-6">
        <h3 className="text-sm font-bold text-slate-800">Eligibility checks on file</h3>
        {(workspace.data?.eligibility ?? []).length ? (
          <ul className="space-y-2 text-sm">
            {workspace.data!.eligibility.map((row) => (
              <li key={row.id} className="rounded-xl border border-slate-200 px-4 py-3">
                <p className="font-medium">
                  {row.outcome} · {row.source}
                </p>
                <p className="text-xs text-slate-500">
                  {ELIGIBILITY_KIND_LABEL[row.verificationKind ?? ''] ??
                    ELIGIBILITY_KIND_LABEL.recorded_without_insurer_response}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No SHA eligibility rows loaded in this workspace snapshot.</p>
        )}
      </Card>

      <Card className="space-y-3 p-6">
        <h3 className="text-sm font-bold text-slate-800">Claim drafts</h3>
        {(workspace.data?.claims ?? []).length ? (
          <div className="space-y-4">
            {workspace.data!.claims.map((claim) => {
              const draft = transition[claim.id] ?? {
                status: claim.allowedTransitions[0] ?? '',
                reason: '',
                externalReference: claim.externalReference ?? '',
              }
              const nextIsRemit = isRemittance(draft.status)
              return (
                <div key={claim.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                  <p className="font-semibold">{claim.status}</p>
                  <p className="text-xs text-slate-500">
                    Charges {claim.totalCharge} · received {claim.amountReceived} · portal {claim.externalReference ?? '—'} ·{' '}
                    {claim.cashEquivalent ? 'Remittance recorded (not a new cashier payment)' : 'Not cash'}
                  </p>
                  {claim.allowedTransitions.length ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-slate-600">Next status</span>
                        <select
                          className="input"
                          value={draft.status}
                          onChange={(event) =>
                            setTransition((current) => ({
                              ...current,
                              [claim.id]: { ...draft, status: event.target.value },
                            }))
                          }
                        >
                          {claim.allowedTransitions.map((status) => (
                            <option key={status} value={status} disabled={isRemittance(status) && !canRemit}>
                              {status}
                              {isRemittance(status) && !canRemit ? ' (finance only)' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Field
                        name={`ref-${claim.id}`}
                        label="Portal / SHA number"
                        value={draft.externalReference}
                        onChange={(event) =>
                          setTransition((current) => ({
                            ...current,
                            [claim.id]: { ...draft, externalReference: event.target.value },
                          }))
                        }
                      />
                      <Field
                        name={`reason-${claim.id}`}
                        label="Reason"
                        value={draft.reason}
                        onChange={(event) =>
                          setTransition((current) => ({
                            ...current,
                            [claim.id]: { ...draft, reason: event.target.value },
                          }))
                        }
                      />
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">No further transitions.</p>
                  )}
                  {claim.allowedTransitions.length ? (
                    <Button
                      className="mt-3"
                      type="button"
                      disabled={!canPrepare || !draft.status || (nextIsRemit && !canRemit)}
                      loading={changeStatus.isPending}
                      onClick={() =>
                        changeStatus.mutate({
                          id: claim.id,
                          status: draft.status,
                          reason: draft.reason,
                          externalReference: draft.externalReference,
                        })
                      }
                    >
                      Record status
                    </Button>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No operational drafts yet.</p>
        )}
      </Card>
    </div>
  )
}
