import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList } from 'lucide-react'
import { Alert, Button, Card, Field, PageHeader } from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'

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

export function ClinicalOrdersDashboard() {
  const queryClient = useQueryClient()
  const [moduleFilter, setModuleFilter] = useState('')
  const [patient, setPatient] = useState<PatientSearchItem | null>(null)
  const [medication, setMedication] = useState('')
  const [dose, setDose] = useState('')

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['clinical-orders', moduleFilter],
    queryFn: () =>
      apiRequest<ClinicalOrder[]>(
        `/clinical-orders?limit=100${moduleFilter ? `&module=${moduleFilter}` : ''}`,
      ),
    refetchInterval: 20_000,
  })

  const createPharmacy = useMutation({
    mutationFn: () =>
      apiRequest('/clinical-orders/pharmacy', {
        method: 'POST',
        body: JSON.stringify({
          patientId: patient?.id,
          medication,
          dose: dose || undefined,
          priority: 'routine',
        }),
      }),
    onSuccess: async () => {
      notify('Pharmacy order created', 'Order mirrored into clinical orders.', 'success')
      setMedication('')
      setDose('')
      await queryClient.invalidateQueries({ queryKey: ['clinical-orders'] })
    },
    onError: (error: Error) => notify('Order failed', error.message, 'critical'),
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="bg-gradient-to-br from-slate-900 to-indigo-950 p-8 text-white">
        <PageHeader
          title="Clinical orders"
          description="Unified view of laboratory, imaging, and pharmacy orders across the hospital."
        />
      </Card>

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

      <Card className="p-6">
        <PageHeader
          title="New pharmacy order"
          description="Creates a medication order in the unified clinical orders feed (pilot)."
        />
        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">Patient</p>
            <PatientSearchAutocomplete selected={patient} onSelect={setPatient} />
          </div>
          <Field
            name="medication"
            label="Medication"
            value={medication}
            onChange={(e) => setMedication(e.target.value)}
            required
          />
          <Field name="dose" label="Dose" value={dose} onChange={(e) => setDose(e.target.value)} />
          {createPharmacy.error ? <Alert tone="error">{createPharmacy.error.message}</Alert> : null}
          <Button
            type="button"
            loading={createPharmacy.isPending}
            disabled={!patient || !medication.trim()}
            onClick={() => createPharmacy.mutate()}
          >
            Create pharmacy order
          </Button>
        </div>
      </Card>
    </div>
  )
}

export function PharmacyWorkspace() {
  return (
    <ClinicalOrdersDashboard />
  )
}
