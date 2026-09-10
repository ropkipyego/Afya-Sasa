import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList } from 'lucide-react'
import { Card, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'

type ClinicalOrder = {
  id: string
  orderNo: string
  orderType: string
  sourceModule: string
  status: string
  priority: string
  orderedAt: string
  patient?: { firstName: string; lastName: string; patientNo: string }
  metadata?: Record<string, unknown> | null
}

export function ClinicalOrdersDashboard({ embedded = false }: { embedded?: boolean }) {
  const [moduleFilter, setModuleFilter] = useState('')

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['clinical-orders', moduleFilter],
    queryFn: () =>
      apiRequest<ClinicalOrder[]>(
        `/clinical-orders?limit=100${moduleFilter ? `&module=${moduleFilter}` : ''}`,
      ),
    refetchInterval: 20_000,
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {!embedded ? (
        <Card className="bg-gradient-to-br from-slate-900 to-indigo-950 p-8 text-white">
          <PageHeader
            title="Clinical orders"
            description="Unified view of laboratory, imaging, and pharmacy orders across the hospital."
          />
        </Card>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="font-semibold text-slate-700">Module</span>
          <select
            className="input mt-1 block"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="laboratory">Laboratory</option>
            <option value="radiology">Radiology</option>
            <option value="pharmacy">Pharmacy</option>
          </select>
        </label>
      </div>

      <Card className="p-6">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <ClipboardList className="h-5 w-5 text-teal-700" />
          Open orders ({orders.length})
        </h3>
        {isLoading ? (
          <div className="mt-4 h-32 animate-skeleton rounded-xl" />
        ) : (
          <ul className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto">
            {orders.map((order) => (
              <li key={order.id} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {order.orderNo} · {order.sourceModule}
                    </p>
                    <p className="text-slate-600">
                      {order.patient
                        ? `${order.patient.firstName} ${order.patient.lastName} (${order.patient.patientNo})`
                        : 'Patient'}
                    </p>
                    {order.metadata?.medication ? (
                      <p className="text-xs text-teal-800">
                        {String(order.metadata.medication)}
                        {order.metadata.dose ? ` · ${String(order.metadata.dose)}` : ''}
                        {order.metadata.quantity != null ? ` · qty ${String(order.metadata.quantity)}` : ''}
                      </p>
                    ) : null}
                    <p className="text-xs text-slate-400">
                      {new Date(order.orderedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">
                      {order.status}
                    </span>
                    <p className="mt-1 text-xs text-slate-500">{order.priority}</p>
                    {order.sourceModule === 'pharmacy' && order.status !== 'dispensed' ? (
                      <p className="mt-2 text-xs text-teal-800">Dispense from the Pharmacy desk</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
            {!orders.length ? (
              <p className="py-10 text-center text-sm text-slate-500">No clinical orders found.</p>
            ) : null}
          </ul>
        )}
      </Card>
    </div>
  )
}
