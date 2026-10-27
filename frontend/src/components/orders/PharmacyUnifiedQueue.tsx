import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, PageHeader } from '../ui'
import { apiRequest, formatApiError } from '../../lib/api'
import { formatKes } from '../../lib/clinical-catalog'
import { notify } from '../../lib/notify'
import { PharmacyWorkspace, type DispenseFilter } from './PharmacyWorkspace'
import { PharmacySalesPanel } from './PharmacySalesPanel'
import { WorkspaceTabs } from '../ui/WorkspaceTabs'
import { useAuthStore } from '../../lib/auth-store'

type QueueMode = 'opd' | 'ipd' | 'otc' | 'pending' | 'partial' | 'history'

type OtcQueueItem = {
  chargeId: string
  saleId: string
  serviceEntityId: string | null
  orderNo: string
  customerName: string
  patientNo: string | null
  description: string
  amountOwed: number
  amountPaid: number
  amountWaived: number
  status: string
  createdAt: string
}

type SaleClearanceStatus = {
  saleId: string
  reservedQuantity: number
  remaining: number | null
  clearance: { cleared: boolean; reason: string; message: string }
}

export function PharmacyUnifiedQueue({
  initialMode = 'opd',
  onOpenPos,
}: {
  initialMode?: QueueMode
  onOpenPos?: () => void
}) {
  const [mode, setMode] = useState<QueueMode>(initialMode)
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const canDispense = useAuthStore((s) => (s.user?.permissions ?? []).includes('pharmacy:dispense'))
  const canCancelHold = useAuthStore((s) => {
    const permissions = s.user?.permissions ?? []
    return permissions.includes('pharmacy:dispense') || permissions.includes('payments:manage')
  })

  const { data: dashboard, isLoading: otcLoading, error: otcError } = useQuery({
    queryKey: ['pharmacy-dashboard', 'otc-queue'],
    queryFn: () =>
      apiRequest<{ openOtcQueue: OtcQueueItem[] }>('/inventory/pharmacy-dashboard'),
    enabled: mode === 'otc',
    refetchInterval: 15_000,
  })

  const { data: selectedClearance } = useQuery({
    queryKey: ['pharmacy-sale', selectedSaleId],
    queryFn: () => apiRequest<SaleClearanceStatus>(`/inventory/sales/${selectedSaleId}`),
    enabled: Boolean(selectedSaleId && mode === 'otc'),
    refetchInterval: 8_000,
  })

  const issueOtc = useMutation({
    mutationFn: (saleId: string) =>
      apiRequest('/inventory/dispense/otc', {
        method: 'POST',
        body: JSON.stringify({ saleId, confirm: true }),
      }),
    onSuccess: async () => {
      notify('OTC sale issued', 'Reserved stock consumed and DISPENSE written to ledger.', 'success')
      setSelectedSaleId(null)
      await queryClient.invalidateQueries({ queryKey: ['pharmacy-dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['inventory-balances'] })
    },
    onError: (err: Error) => notify('Could not issue OTC sale', formatApiError(err, err.message), 'critical'),
  })

  const cancelOtc = useMutation({
    mutationFn: (saleId: string) =>
      apiRequest('/inventory/sales/cancel', {
        method: 'POST',
        body: JSON.stringify({ saleId, reason: 'Cancelled from Prescription & OTC Queue' }),
      }),
    onSuccess: async () => {
      notify('Hold released', 'Reservation released. Collected payments are never erased.', 'success')
      setSelectedSaleId(null)
      await queryClient.invalidateQueries({ queryKey: ['pharmacy-dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['inventory-balances'] })
    },
    onError: (err: Error) => notify('Could not cancel sale', formatApiError(err, err.message), 'critical'),
  })

  return (
    <div className="space-y-4">
      <WorkspaceTabs
        active={mode}
        onChange={setMode}
        tabs={[
          { id: 'opd', label: 'OPD Prescriptions' },
          { id: 'ipd', label: 'IPD Prescriptions' },
          { id: 'otc', label: 'OTC Sales / Orders' },
          { id: 'pending', label: 'All Pending Rx' },
          { id: 'partial', label: 'Partial Rx' },
          { id: 'history', label: 'Rx History' },
        ]}
      />

      {mode !== 'otc' ? (
        <PharmacyWorkspace filter={mode as DispenseFilter} />
      ) : (
        <div className="space-y-5">
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <PageHeader
                title="OTC Sales & Walk-in Orders Queue"
                description="Prepared OTC sales awaiting cashier payment or final pharmacy issue."
              />
              {onOpenPos ? (
                <Button type="button" onClick={onOpenPos}>
                  New OTC Sale (POS)
                </Button>
              ) : null}
            </div>

            {otcError ? (
              <Alert tone="error" className="mt-4">
                {formatApiError(otcError, 'Could not load OTC queue.')}
              </Alert>
            ) : null}

            {otcLoading ? (
              <div className="mt-4 h-36 animate-skeleton rounded-xl" />
            ) : (dashboard?.openOtcQueue ?? []).length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="pb-2 pr-3">Order / Sale ID</th>
                      <th className="pb-2 pr-3">Customer</th>
                      <th className="pb-2 pr-3">Items</th>
                      <th className="pb-2 pr-3">Charged</th>
                      <th className="pb-2 pr-3">Paid</th>
                      <th className="pb-2 pr-3">Bill Status</th>
                      <th className="pb-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dashboard?.openOtcQueue ?? []).map((row) => {
                      const activeKey = row.serviceEntityId ?? row.saleId
                      return (
                        <tr key={row.chargeId} className="border-b border-slate-100">
                          <td className="py-2.5 pr-3">
                            <p className="font-semibold">{row.orderNo}</p>
                            <p className="font-mono text-xs text-slate-500">{row.saleId}</p>
                          </td>
                          <td className="py-2.5 pr-3">
                            {row.customerName}
                            {row.patientNo ? <span className="ml-1 text-xs text-slate-500">({row.patientNo})</span> : null}
                          </td>
                          <td className="py-2.5 pr-3">{row.description}</td>
                          <td className="py-2.5 pr-3 tabular-nums">{formatKes(row.amountOwed)}</td>
                          <td className="py-2.5 pr-3 tabular-nums">{formatKes(row.amountPaid)}</td>
                          <td className="py-2.5 pr-3 uppercase text-xs font-semibold">{row.status}</td>
                          <td className="py-2.5">
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => setSelectedSaleId(activeKey)}
                            >
                              Inspect / Issue
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">
                No prepared OTC sales waiting in the queue.
              </p>
            )}

            {selectedSaleId && selectedClearance ? (
              <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950">
                <p className="font-semibold">Sale {selectedSaleId}</p>
                <p className="mt-1">
                  Reserved units: <strong>{selectedClearance.reservedQuantity}</strong> ·{' '}
                  {selectedClearance.clearance.message}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={
                      !canDispense ||
                      !selectedClearance.clearance.cleared ||
                      selectedClearance.reservedQuantity <= 0 ||
                      issueOtc.isPending
                    }
                    loading={issueOtc.isPending}
                    onClick={() => issueOtc.mutate(selectedSaleId)}
                  >
                    Issue medicine after clearance
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={
                      !canCancelHold ||
                      selectedClearance.reservedQuantity <= 0 ||
                      cancelOtc.isPending
                    }
                    loading={cancelOtc.isPending}
                    onClick={() => cancelOtc.mutate(selectedSaleId)}
                  >
                    Cancel unpaid hold
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>

          <PharmacySalesPanel mode="all" />
        </div>
      )}
    </div>
  )
}
