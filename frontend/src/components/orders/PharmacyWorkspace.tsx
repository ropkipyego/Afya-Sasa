import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList } from 'lucide-react'
import { Button, Card, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'

type PharmacyOrder = {
  id: string
  orderNo: string
  status: string
  priority: string
  orderedAt: string
  patient?: { firstName: string; lastName: string; patientNo: string }
  metadata?: { medication?: string; dose?: string; route?: string; frequency?: string } | null
}

export function PharmacyWorkspace() {
  const queryClient = useQueryClient()
  const [dispenseQty, setDispenseQty] = useState('10')

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['clinical-orders', 'pharmacy'],
    queryFn: () => apiRequest<PharmacyOrder[]>('/clinical-orders?module=pharmacy&limit=100'),
    refetchInterval: 20_000,
  })

  const pending = orders.filter((o) => o.status !== 'dispensed' && o.status !== 'cancelled')
  const completed = orders.filter((o) => o.status === 'dispensed')

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['clinical-orders'] })
    void queryClient.invalidateQueries({ queryKey: ['inventory-balances'] })
  }

  const dispense = useMutation({
    mutationFn: (orderId: string) =>
      apiRequest('/inventory/dispense/pharmacy', {
        method: 'POST',
        body: JSON.stringify({
          clinicalOrderId: orderId,
          quantity: Number(dispenseQty) || 10,
        }),
      }),
    onSuccess: () => {
      notify('Dispensed', 'FEFO batch selected and stock deducted.', 'success')
      invalidate()
    },
    onError: (e: Error) => notify('Dispense failed', e.message, 'critical'),
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="bg-gradient-to-br from-emerald-900 to-teal-950 p-8 text-white">
        <PageHeader
          title="Prescription queue"
          description="Review clinician orders, dispense from pharmacy stock, and update the medication record."
        />
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <span className="rounded-xl bg-white/15 px-4 py-2">
            Pending: <strong>{pending.length}</strong>
          </span>
          <span className="rounded-xl bg-white/15 px-4 py-2">
            Dispensed: <strong>{completed.length}</strong>
          </span>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <ClipboardList className="h-5 w-5 text-teal-700" />
          Awaiting dispense
        </h3>
        <label className="mt-4 block text-sm">
          <span className="font-medium text-slate-700">Default dispense quantity</span>
          <input
            className="input mt-1 w-24"
            type="number"
            min={1}
            value={dispenseQty}
            onChange={(e) => setDispenseQty(e.target.value)}
          />
        </label>
        {isLoading ? (
          <div className="mt-4 h-40 animate-skeleton rounded-xl" />
        ) : (
          <ul className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto">
            {pending.map((order) => (
              <li key={order.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{order.orderNo}</p>
                    <p className="text-slate-700">
                      {order.patient
                        ? `${order.patient.firstName} ${order.patient.lastName} · ${order.patient.patientNo}`
                        : 'Patient'}
                    </p>
                    {order.metadata?.medication ? (
                      <p className="mt-1 font-medium text-teal-900">
                        {order.metadata.medication}
                        {order.metadata.dose ? ` — ${order.metadata.dose}` : ''}
                        {order.metadata.frequency ? ` · ${order.metadata.frequency}` : ''}
                      </p>
                    ) : null}
                    <p className="text-xs text-slate-400">
                      {new Date(order.orderedAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    type="button"
                    loading={dispense.isPending}
                    onClick={() => dispense.mutate(order.id)}
                  >
                    Dispense
                  </Button>
                </div>
              </li>
            ))}
            {!pending.length ? (
              <p className="py-8 text-center text-slate-500">No pending prescriptions.</p>
            ) : null}
          </ul>
        )}
      </Card>
    </div>
  )
}
