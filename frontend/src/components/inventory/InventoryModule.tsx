import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightLeft,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  PackagePlus,
  Percent,
  ShoppingCart,
  Truck,
} from 'lucide-react'
import { Alert, Button, Card, Field, PageHeader, Select } from '../ui'
import { WorkspaceTabs } from '../ui/WorkspaceTabs'
import { apiRequest } from '../../lib/api'
import { drugClassLabel } from '../../lib/drug-class'
import { notify } from '../../lib/notify'
import { InventoryOverview } from './InventoryOverview'
import { ProcurementPanel } from './ProcurementPanel'
import { InventoryPricesPanel } from './InventoryPricesPanel'
import { StockTakeWorkspace } from './StockTakeWorkspace'

type InventoryLocation = {
  id: string
  code: string
  name: string
  locationType: string
}

type InventoryItem = {
  id: string
  sku: string
  name: string
  category: 'pharmaceutical' | 'medical_consumable' | 'non_medical'
  drugClass?: string | null
  unit: string
}

type InventoryBatch = {
  id: string
  batchNo: string | null
  expiryDate: string | null
  qtyOnHand: string
  item: InventoryItem
}

type RequisitionLine = {
  id: string
  quantityRequested: string
  quantityIssued: string
  fulfillmentRoute: 'pharmacy' | 'main_store'
  status: string
  item: InventoryItem
  sourceLocation: InventoryLocation
}

type Requisition = {
  id: string
  requisitionNo: string
  requestingDepartment: string
  status: 'submitted' | 'approved' | 'issued' | 'completed' | 'cancelled'
  notes: string | null
  createdAt: string
  lines: RequisitionLine[]
}

type Tab =
  | 'overview'
  | 'stock'
  | 'prices'
  | 'stocktake'
  | 'requisitions'
  | 'procurement'
  | 'transfers'
  | 'receive'
  | 'ledger'

const statusClass: Record<Requisition['status'], string> = {
  submitted: 'bg-sky-100 text-sky-800',
  approved: 'bg-amber-100 text-amber-900',
  issued: 'bg-indigo-100 text-indigo-900',
  completed: 'bg-emerald-100 text-emerald-900',
  cancelled: 'bg-slate-100 text-slate-600',
}

const routeLabel = {
  pharmacy: 'Pharmacy',
  main_store: 'Main store',
} as const

export function InventoryModule() {
  const [tab, setTab] = useState<Tab>('overview')
  const [receiveItemId, setReceiveItemId] = useState('')

  return (
    <div className="workspace-shell animate-fade-in space-y-6">
      <PageHeader
        title="Inventory & store"
        description="Supply desk — main store, requisitions, transfers, and goods receipt. Pharmacy dispenses from the PHARMACY location."
      />
      <WorkspaceTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
          { id: 'stock', label: 'Stock', icon: <Boxes className="h-4 w-4" /> },
          { id: 'prices', label: 'Prices', icon: <Percent className="h-4 w-4" /> },
          { id: 'stocktake', label: 'Stock take', icon: <ClipboardCheck className="h-4 w-4" /> },
          { id: 'requisitions', label: 'Requisitions', icon: <Truck className="h-4 w-4" /> },
          { id: 'procurement', label: 'Buying list', icon: <ShoppingCart className="h-4 w-4" /> },
          { id: 'transfers', label: 'Transfers', icon: <ArrowRightLeft className="h-4 w-4" /> },
          { id: 'receive', label: 'Receive', icon: <PackagePlus className="h-4 w-4" /> },
          { id: 'ledger', label: 'Ledger', icon: <ClipboardList className="h-4 w-4" /> },
        ]}
      />
      {tab === 'overview' ? <InventoryOverview onOpen={setTab} /> : null}
      {tab === 'stock' ? <StockPanel /> : null}
      {tab === 'prices' ? <InventoryPricesPanel /> : null}
      {tab === 'stocktake' ? <StockTakeWorkspace /> : null}
      {tab === 'requisitions' ? <RequisitionsPanel /> : null}
      {tab === 'procurement' ? (
        <ProcurementPanel
          onReceiveItem={(itemId) => {
            setReceiveItemId(itemId)
            setTab('receive')
          }}
          onOpenRequisitions={() => setTab('requisitions')}
        />
      ) : null}
      {tab === 'transfers' ? <TransfersPanel /> : null}
      {tab === 'receive' ? <ReceiveStockPanel initialItemId={receiveItemId} /> : null}
      {tab === 'ledger' ? <LedgerPanel /> : null}
    </div>
  )
}

type InventoryTransaction = {
  id: string
  transactionType: string
  quantity: string
  unit: string
  reason: string | null
  createdAt: string
  item: InventoryItem
  sourceLocation: InventoryLocation | null
  destinationLocation: InventoryLocation | null
}

function LedgerPanel() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['inventory-transactions'],
    queryFn: () => apiRequest<InventoryTransaction[]>('/inventory/transactions?limit=150'),
    refetchInterval: 30_000,
  })

  return (
    <Card className="p-6">
      <PageHeader
        title="Stock movement ledger"
        description="Auditable record of receipts, issues, dispenses, and transfers."
      />
      {isLoading ? (
        <div className="mt-6 h-48 animate-skeleton rounded-xl" />
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-3 pr-4">When</th>
                <th className="pb-3 pr-4">Type</th>
                <th className="pb-3 pr-4">Item</th>
                <th className="pb-3 pr-4">Qty</th>
                <th className="pb-3 pr-4">From → To</th>
                <th className="pb-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 whitespace-nowrap text-xs text-slate-500">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs">{row.transactionType}</td>
                  <td className="py-3 pr-4 font-medium">{row.item.name}</td>
                  <td className="py-3 pr-4 tabular-nums">
                    {row.quantity} {row.unit}
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-600">
                    {row.sourceLocation?.code ?? '—'} → {row.destinationLocation?.code ?? '—'}
                  </td>
                  <td className="py-3 max-w-xs truncate text-slate-600">{row.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? (
            <p className="py-12 text-center text-sm text-slate-500">No ledger entries yet.</p>
          ) : null}
        </div>
      )}
    </Card>
  )
}

function StockPanel() {
  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => apiRequest<InventoryLocation[]>('/inventory/locations'),
  })
  const [locationId, setLocationId] = useState('')

  const activeLocationId = locationId || locations[0]?.id || ''

  const { data: balances, isLoading } = useQuery({
    queryKey: ['inventory-balances', activeLocationId],
    queryFn: () =>
      apiRequest<{ location: InventoryLocation; batches: InventoryBatch[] }>(
        `/inventory/locations/${activeLocationId}/balances`,
      ),
    enabled: Boolean(activeLocationId),
  })

  const batches = balances?.batches ?? []

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader title="Location balances" description="Batch-level stock at each store location." />
        <label className="text-sm">
          <span className="font-medium text-slate-700">Location</span>
          <Select
            className="mt-1 min-w-[14rem]"
            value={activeLocationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {isLoading ? (
        <div className="mt-6 h-40 animate-skeleton rounded-xl" />
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-3 pr-4">Item</th>
                <th className="pb-3 pr-4">SKU</th>
                <th className="pb-3 pr-4">Batch</th>
                <th className="pb-3 pr-4">Expiry</th>
                <th className="pb-3 text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-slate-900">{batch.item.name}</p>
                    <p className="text-xs text-slate-500">{drugClassLabel(batch.item.drugClass)}</p>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-600">{batch.item.sku}</td>
                  <td className="py-3 pr-4">{batch.batchNo ?? '—'}</td>
                  <td className="py-3 pr-4">{batch.expiryDate ?? '—'}</td>
                  <td className="py-3 text-right font-semibold tabular-nums">
                    {batch.qtyOnHand} {batch.item.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!batches.length ? (
            <p className="py-12 text-center text-sm text-slate-500">No stock at this location yet.</p>
          ) : null}
        </div>
      )}
    </Card>
  )
}

function RequisitionsPanel() {
  const queryClient = useQueryClient()
  const [department, setDepartment] = useState('General Ward')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Array<{ itemId: string; quantity: string }>>([
    { itemId: '', quantity: '' },
  ])

  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => apiRequest<InventoryItem[]>('/inventory/items'),
  })

  const { data: requisitions = [], isLoading } = useQuery({
    queryKey: ['inventory-requisitions'],
    queryFn: () => apiRequest<Requisition[]>('/inventory/requisitions'),
    refetchInterval: 15_000,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['inventory-requisitions'] })
    void queryClient.invalidateQueries({ queryKey: ['inventory-balances'] })
  }

  const createReq = useMutation({
    mutationFn: () => {
      const payload = {
        requestingDepartment: department.trim(),
        notes: notes.trim() || undefined,
        lines: lines
          .filter((l) => l.itemId && Number(l.quantity) > 0)
          .map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity) })),
      }
      return apiRequest<Requisition>('/inventory/requisitions', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      notify('Requisition submitted', 'Routed to pharmacy or main store by item type.', 'success')
      setNotes('')
      setLines([{ itemId: '', quantity: '' }])
      invalidate()
    },
    onError: (e: Error) => notify('Could not create requisition', e.message, 'critical'),
  })

  const action = useMutation({
    mutationFn: ({ id, step }: { id: string; step: 'approve' | 'issue' | 'acknowledge' }) =>
      apiRequest(`/inventory/requisitions/${id}/${step}`, { method: 'POST', body: '{}' }),
    onSuccess: (_, { step }) => {
      const labels = { approve: 'Approved', issue: 'Issued from store', acknowledge: 'Completed' }
      notify(labels[step], 'Stock ledger updated.', 'success')
      invalidate()
    },
    onError: (e: Error) => notify('Action failed', e.message, 'critical'),
  })

  const itemOptions = useMemo(
    () => items.map((i) => ({ value: i.id, label: `${i.name} (${i.sku})` })),
    [items],
  )

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <Card className="p-6 xl:col-span-2">
        <PageHeader
          title="New requisition"
          description="One form for the ward — medicines route to pharmacy, consumables to main store."
        />
        <div className="mt-4 space-y-4">
          <Field
            name="department"
            label="Requesting department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            required
          />
          <Field
            name="notes"
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">Line items</p>
            {lines.map((line, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_6rem]">
                <Select
                  value={line.itemId}
                  onChange={(e) => {
                    const next = [...lines]
                    next[index] = { ...next[index], itemId: e.target.value }
                    setLines(next)
                  }}
                >
                  <option value="">Select item…</option>
                  {itemOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
                <input
                  className="input"
                  type="number"
                  min={0.01}
                  step="any"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) => {
                    const next = [...lines]
                    next[index] = { ...next[index], quantity: e.target.value }
                    setLines(next)
                  }}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() => setLines([...lines, { itemId: '', quantity: '' }])}
            >
              Add line
            </Button>
          </div>
          <Button
            type="button"
            loading={createReq.isPending}
            disabled={!department.trim() || !lines.some((l) => l.itemId && Number(l.quantity) > 0)}
            onClick={() => createReq.mutate()}
          >
            Submit requisition
          </Button>
        </div>
      </Card>

      <Card className="p-6 xl:col-span-3">
        <PageHeader title="Requisition queue" description="Approve, issue, then acknowledge receipt." />
        {isLoading ? (
          <div className="mt-6 h-48 animate-skeleton rounded-xl" />
        ) : (
          <ul className="mt-4 max-h-[36rem] space-y-3 overflow-y-auto">
            {requisitions.map((req) => (
              <li key={req.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{req.requisitionNo}</p>
                    <p className="text-sm text-slate-600">{req.requestingDepartment}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(req.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusClass[req.status]}`}>
                    {req.status}
                  </span>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  {req.lines.map((line) => (
                    <li key={line.id} className="flex items-center gap-2">
                      <ArrowRightLeft className="h-3.5 w-3.5 text-teal-600" />
                      {line.item.name} × {line.quantityRequested} {line.item.unit}
                      <span className="text-xs text-slate-500">→ {routeLabel[line.fulfillmentRoute]}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  {req.status === 'submitted' ? (
                    <Button
                      type="button"
                      variant="secondary"
                      loading={action.isPending}
                      onClick={() => action.mutate({ id: req.id, step: 'approve' })}
                    >
                      Approve
                    </Button>
                  ) : null}
                  {req.status === 'approved' ? (
                    <Button
                      type="button"
                      loading={action.isPending}
                      onClick={() => action.mutate({ id: req.id, step: 'issue' })}
                    >
                      Issue stock
                    </Button>
                  ) : null}
                  {req.status === 'issued' ? (
                    <Button
                      type="button"
                      variant="secondary"
                      loading={action.isPending}
                      onClick={() => action.mutate({ id: req.id, step: 'acknowledge' })}
                    >
                      <ClipboardCheck className="mr-1.5 h-4 w-4" />
                      Acknowledge receipt
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
            {!requisitions.length ? (
              <p className="py-10 text-center text-sm text-slate-500">No requisitions yet.</p>
            ) : null}
          </ul>
        )}
      </Card>
    </div>
  )
}

type Transfer = {
  id: string
  transferNo: string
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled'
  notes: string | null
  createdAt: string
  sourceLocation: InventoryLocation
  destinationLocation: InventoryLocation
  lines: Array<{ id: string; quantity: string; item: InventoryItem }>
}

const transferStatusClass: Record<Transfer['status'], string> = {
  pending: 'bg-amber-100 text-amber-900',
  in_transit: 'bg-indigo-100 text-indigo-900',
  completed: 'bg-emerald-100 text-emerald-900',
  cancelled: 'bg-slate-100 text-slate-600',
}

function TransfersPanel() {
  const queryClient = useQueryClient()
  const [sourceId, setSourceId] = useState('')
  const [destId, setDestId] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Array<{ itemId: string; quantity: string }>>([
    { itemId: '', quantity: '' },
  ])

  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => apiRequest<InventoryLocation[]>('/inventory/locations'),
  })

  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => apiRequest<InventoryItem[]>('/inventory/items'),
  })

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['inventory-transfers'],
    queryFn: () => apiRequest<Transfer[]>('/inventory/transfers'),
    refetchInterval: 15_000,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] })
    void queryClient.invalidateQueries({ queryKey: ['inventory-balances'] })
  }

  const createTransfer = useMutation({
    mutationFn: () =>
      apiRequest('/inventory/transfers', {
        method: 'POST',
        body: JSON.stringify({
          sourceLocationId: sourceId,
          destinationLocationId: destId,
          notes: notes.trim() || undefined,
          lines: lines
            .filter((l) => l.itemId && Number(l.quantity) > 0)
            .map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity) })),
        }),
      }),
    onSuccess: () => {
      notify('Transfer created', 'Ship when stock is ready to move.', 'success')
      setNotes('')
      setLines([{ itemId: '', quantity: '' }])
      invalidate()
    },
    onError: (e: Error) => notify('Transfer failed', e.message, 'critical'),
  })

  const action = useMutation({
    mutationFn: ({ id, step }: { id: string; step: 'ship' | 'receive' }) =>
      apiRequest(`/inventory/transfers/${id}/${step}`, { method: 'POST', body: '{}' }),
    onSuccess: (_, { step }) => {
      notify(step === 'ship' ? 'Shipped' : 'Received', 'Stock balances updated.', 'success')
      invalidate()
    },
    onError: (e: Error) => notify('Transfer action failed', e.message, 'critical'),
  })

  const mainStore = locations.find((l) => l.code === 'MAIN_STORE')
  const ward = locations.find((l) => l.code === 'WARD-GENERAL')

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <Card className="p-6 xl:col-span-2">
        <PageHeader title="New transfer" description="Move stock between locations." />
        <div className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">From</span>
            <Select className="mt-1" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              <option value="">Select source…</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </Select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">To</span>
            <Select className="mt-1" value={destId} onChange={(e) => setDestId(e.target.value)}>
              <option value="">Select destination…</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </Select>
          </label>
          {!sourceId && mainStore ? (
            <button type="button" className="text-xs font-medium text-teal-700 hover:underline" onClick={() => setSourceId(mainStore.id)}>
              Use Main Store as source
            </button>
          ) : null}
          {!destId && ward ? (
            <button type="button" className="text-xs font-medium text-teal-700 hover:underline" onClick={() => setDestId(ward.id)}>
              Use General Ward as destination
            </button>
          ) : null}
          <Field name="notes" label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">Items</p>
            {lines.map((line, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_6rem]">
                <Select
                  value={line.itemId}
                  onChange={(e) => {
                    const next = [...lines]
                    next[index] = { ...next[index], itemId: e.target.value }
                    setLines(next)
                  }}
                >
                  <option value="">Select item…</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </Select>
                <input className="input" type="number" min={0.01} placeholder="Qty" value={line.quantity}
                  onChange={(e) => {
                    const next = [...lines]
                    next[index] = { ...next[index], quantity: e.target.value }
                    setLines(next)
                  }}
                />
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={() => setLines([...lines, { itemId: '', quantity: '' }])}>
              Add line
            </Button>
          </div>
          <Button
            type="button"
            loading={createTransfer.isPending}
            disabled={!sourceId || !destId || sourceId === destId || !lines.some((l) => l.itemId && Number(l.quantity) > 0)}
            onClick={() => createTransfer.mutate()}
          >
            Create transfer
          </Button>
        </div>
      </Card>
      <Card className="p-6 xl:col-span-3">
        <PageHeader title="Transfer queue" description="Ship from source, then confirm receipt." />
        {isLoading ? (
          <div className="mt-6 h-48 animate-skeleton rounded-xl" />
        ) : (
          <ul className="mt-4 max-h-[36rem] space-y-3 overflow-y-auto">
            {transfers.map((tr) => (
              <li key={tr.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{tr.transferNo}</p>
                    <p className="text-sm text-slate-600">{tr.sourceLocation.name} → {tr.destinationLocation.name}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${transferStatusClass[tr.status]}`}>
                    {tr.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {tr.lines.map((line) => (
                    <li key={line.id}>{line.item.name} × {line.quantity} {line.item.unit}</li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tr.status === 'pending' ? (
                    <Button type="button" loading={action.isPending} onClick={() => action.mutate({ id: tr.id, step: 'ship' })}>Ship</Button>
                  ) : null}
                  {tr.status === 'in_transit' ? (
                    <Button type="button" variant="secondary" loading={action.isPending} onClick={() => action.mutate({ id: tr.id, step: 'receive' })}>Confirm receipt</Button>
                  ) : null}
                </div>
              </li>
            ))}
            {!transfers.length ? <p className="py-10 text-center text-sm text-slate-500">No transfers yet.</p> : null}
          </ul>
        )}
      </Card>
    </div>
  )
}

function ReceiveStockPanel({ initialItemId = '' }: { initialItemId?: string }) {
  const queryClient = useQueryClient()
  const [itemId, setItemId] = useState(initialItemId)
  const [locationId, setLocationId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [batchNo, setBatchNo] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [reason, setReason] = useState('')

  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => apiRequest<InventoryLocation[]>('/inventory/locations'),
  })

  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => apiRequest<InventoryItem[]>('/inventory/items'),
  })

  useEffect(() => {
    if (initialItemId) setItemId(initialItemId)
  }, [initialItemId])

  const selectedItem = items.find((i) => i.id === itemId)
  const isPharma = selectedItem?.category === 'pharmaceutical'

  const receive = useMutation({
    mutationFn: () =>
      apiRequest('/inventory/receipts', {
        method: 'POST',
        body: JSON.stringify({
          itemId,
          locationId,
          quantity: Number(quantity),
          batchNo: batchNo.trim() || undefined,
          expiryDate: expiryDate || undefined,
          reason: reason.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      notify('Stock received', 'Ledger updated and balance increased.', 'success')
      setQuantity('')
      setBatchNo('')
      setExpiryDate('')
      setReason('')
      void queryClient.invalidateQueries({ queryKey: ['inventory-balances'] })
    },
    onError: (e: Error) => notify('Receipt failed', e.message, 'critical'),
  })

  const pharmacyLoc = locations.find((l) => l.code === 'PHARMACY')
  const mainStoreLoc = locations.find((l) => l.code === 'MAIN_STORE')

  return (
    <Card className="max-w-xl p-6">
      <PageHeader
        title="Receive stock (GRN)"
        description="Pharmaceuticals must go to pharmacy with batch and expiry."
      />
      <div className="mt-4 space-y-4">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Item</span>
          <Select className="mt-1" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Select item…</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.sku})
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Location</span>
          <Select className="mt-1" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">Select location…</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </Select>
        </label>
        {selectedItem && !locationId ? (
          <Alert tone="info">
            {isPharma
              ? `Suggested: ${pharmacyLoc?.name ?? 'Pharmacy'}`
              : `Suggested: ${mainStoreLoc?.name ?? 'Main store'}`}
          </Alert>
        ) : null}
        <Field
          name="quantity"
          label="Quantity"
          type="number"
          min={0.01}
          step="any"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
        {isPharma ? (
          <>
            <Field
              name="batchNo"
              label="Batch number"
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
              required
            />
            <Field
              name="expiryDate"
              label="Expiry date"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              required
            />
          </>
        ) : null}
        <Field
          name="reason"
          label="Reference / notes"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="GRN number, supplier, etc."
        />
        <Button
          type="button"
          loading={receive.isPending}
          disabled={
            !itemId ||
            !locationId ||
            !quantity ||
            (isPharma && (!batchNo.trim() || !expiryDate))
          }
          onClick={() => receive.mutate()}
        >
          Post receipt
        </Button>
      </div>
    </Card>
  )
}
