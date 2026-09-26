import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Field, SelectField } from '../ui'
import { apiRequest, formatApiError } from '../../lib/api'
import { formatKes } from '../../lib/clinical-catalog'
import { notify } from '../../lib/notify'
import { useAuthStore } from '../../lib/auth-store'

export type AdmissionAccount = {
  admission: {
    id: string
    admissionNo: string
    status: string
    admittedAt: string
    dischargedAt: string | null
    ward: string
    wardType: string
    bed: string
    patient: { id: string; patientNo: string; name: string }
  }
  stay: {
    admissionDate: string
    ward: string
    bed: string
    accommodationType?: string | null
    chargeItemCode?: string | null
    plannedDays: number
    transfers: { at: string; from: string; to: string; reason: string }[]
  }
  policy: {
    dayCount: string
    sameDay: string
    dayAnchor: string
    blockDischargeOnBalance: boolean
  }
  charges: Array<{
    id: string
    date: string
    charge: string
    quantity: number
    unitPrice: number
    total: number
    paid: number
    remaining: number
    source: string
    status: string
  }>
  payments: Array<{
    id: string
    date: string
    amount: number
    method: string
    status: string
    reference?: string | null
  }>
  totals: { charges: number; payments: number; waived: number; outstanding: number }
  byDepartment?: Record<string, number>
  missingRates: Array<{ code: string; name: string }>
}

export function IpdAdmissionAccount({
  admissionId,
  compact = false,
}: {
  admissionId: string
  compact?: boolean
}) {
  const queryClient = useQueryClient()
  const [adjustId, setAdjustId] = useState('')
  const [adjustType, setAdjustType] = useState<'waiver' | 'discount' | 'refund'>('waiver')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const canProcess = useAuthStore((state) => {
    const permissions = state.user?.permissions ?? []
    return permissions.includes('payments:manage') || permissions.includes('settings:manage')
  })

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ipd-account', admissionId],
    queryFn: () => apiRequest<AdmissionAccount>(`/payments/admissions/${admissionId}/account`),
  })

  const process = useMutation({
    mutationFn: () =>
      apiRequest(`/payments/charges/accommodation/process?admissionId=${admissionId}`, {
        method: 'POST',
      }),
    onSuccess: async () => {
      notify('Accommodation charges reviewed', 'Existing days were skipped. Missing priced days were posted once.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['ipd-account', admissionId] })
    },
    onError: (err: Error) => notify('Could not process charges', err.message, 'critical'),
  })

  const adjust = useMutation({
    mutationFn: () =>
      apiRequest(`/payments/charges/${adjustId}/adjust`, {
        method: 'POST',
        body: JSON.stringify({
          type: adjustType,
          amount: Number(adjustAmount),
          reason: adjustReason,
        }),
      }),
    onSuccess: async () => {
      notify('Adjustment recorded', 'Original charge amount is unchanged. The adjustment is audited.', 'success')
      setAdjustAmount('')
      setAdjustReason('')
      await queryClient.invalidateQueries({ queryKey: ['ipd-account', admissionId] })
    },
    onError: (err: Error) =>
      notify('Adjustment failed', formatApiError(err, 'Could not apply the adjustment.'), 'critical'),
  })

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-slate-500">Loading admission account…</p>
  }
  if (isError || !data) {
    return (
      <Alert tone="error">
        {error instanceof Error ? formatApiError(error, 'Unable to load the admission account.') : 'Unable to load the admission account.'}
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AccountTile label="Admission" value={new Date(data.stay.admissionDate).toLocaleString()} />
        <AccountTile label="Ward / bed" value={`${data.stay.ward} · ${data.stay.bed}`} />
        <AccountTile label="Accommodation" value={data.stay.accommodationType ?? data.admission.wardType} />
        <AccountTile label="Planned bed days" value={String(data.stay.plannedDays)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <AccountTile label="Total charges" value={formatKes(data.totals.charges)} tone="slate" />
        <AccountTile label="Total payments" value={formatKes(data.totals.payments)} tone="emerald" />
        <AccountTile label="Outstanding" value={formatKes(data.totals.outstanding)} tone="rose" />
      </div>

      {data.byDepartment && Object.keys(data.byDepartment).length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          {Object.entries(data.byDepartment).map(([name, amount]) => (
            <div key={name} className="flex justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
              <span>{name}</span>
              <span className="tabular-nums font-semibold">{formatKes(amount)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between font-bold">
            <span>Charges</span>
            <span>{formatKes(data.totals.charges)}</span>
          </div>
          <div className="flex justify-between text-emerald-800">
            <span>Paid</span>
            <span>{formatKes(data.totals.payments)}</span>
          </div>
          <div className="flex justify-between text-rose-800">
            <span>Outstanding</span>
            <span>{formatKes(data.totals.outstanding)}</span>
          </div>
        </div>
      ) : null}

      {data.missingRates.length ? (
        <Alert tone="warning">
          Accommodation rates are not configured for {data.missingRates.map((row) => row.name).join(', ')}.
          The engine will not invent a price. Set the hospital rate in Control Center → Hospital charge catalogue.
        </Alert>
      ) : null}

      {data.policy.blockDischargeOnBalance && data.totals.outstanding > 0 ? (
        <Alert tone="warning">Hospital policy currently flags an outstanding balance before discharge. Clinical discharge is still allowed unless you change that policy.</Alert>
      ) : data.totals.outstanding > 0 ? (
        <Alert tone="info">Outstanding {formatKes(data.totals.outstanding)} is visible to cashier. It does not block clinical discharge.</Alert>
      ) : null}

      {canProcess && !compact ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" loading={process.isPending} onClick={() => process.mutate()}>
              Post missing accommodation days
            </Button>
            <Button type="button" variant="ghost" onClick={() => refetch()}>
              Refresh account
            </Button>
          </div>
          <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-4">
            <SelectField name="adjustId" label="Charge" value={adjustId} onChange={(event) => setAdjustId(event.target.value)}>
              <option value="">Select charge…</option>
              {data.charges.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.charge} · bal {formatKes(row.remaining)}
                </option>
              ))}
            </SelectField>
            <SelectField
              name="adjustType"
              label="Adjustment"
              value={adjustType}
              onChange={(event) => setAdjustType(event.target.value as 'waiver' | 'discount' | 'refund')}
            >
              <option value="waiver">Waiver</option>
              <option value="discount">Discount</option>
              <option value="refund">Refund</option>
            </SelectField>
            <Field name="adjustAmount" label="Amount" value={adjustAmount} onChange={(event) => setAdjustAmount(event.target.value)} />
            <Field name="adjustReason" label="Reason" value={adjustReason} onChange={(event) => setAdjustReason(event.target.value)} />
            <div className="md:col-span-4">
              <Button type="button" loading={adjust.isPending} disabled={!adjustId || !adjustReason} onClick={() => adjust.mutate()}>
                Record adjustment
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Card className="overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Charge</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Unit</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.charges.length ? (
              data.charges.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(row.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{row.charge}</td>
                  <td className="px-4 py-3 font-semibold">{row.source}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatKes(row.unitPrice)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatKes(row.total)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatKes(row.paid)}</td>
                  <td className="px-4 py-3">{row.status.replace('_', ' ')}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No operational charges on this admission yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {!compact && data.payments.length ? (
        <div>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Payments received</h4>
          <div className="space-y-2">
            {data.payments.map((row) => (
              <div key={row.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                <span>{new Date(row.date).toLocaleString()} · {row.method}</span>
                <span className="font-semibold tabular-nums">{formatKes(row.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!compact && data.stay.transfers.length ? (
        <div>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Bed history</h4>
          <ul className="space-y-2 text-sm">
            {data.stay.transfers.map((row) => (
              <li key={`${row.at}-${row.from}`} className="rounded-xl border border-slate-200 px-4 py-3">
                {new Date(row.at).toLocaleString()} · {row.from} → {row.to}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function AccountTile({
  label,
  value,
  tone = 'white',
}: {
  label: string
  value: string
  tone?: 'white' | 'slate' | 'emerald' | 'rose'
}) {
  const tones = {
    white: 'border-slate-200 bg-white',
    slate: 'border-slate-200 bg-slate-50',
    emerald: 'border-emerald-200 bg-emerald-50',
    rose: 'border-rose-200 bg-rose-50',
  }
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  )
}
