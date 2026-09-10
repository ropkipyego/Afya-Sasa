import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Upload } from 'lucide-react'
import { Button, Card, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'

type ImportCard = {
  id: string
  title: string
  description: string
  template: string
  endpoint: string
  countQuery: { key: string[]; path: string; pick: (data: unknown) => number }
}

const CARDS: ImportCard[] = [
  {
    id: 'lab',
    title: 'Laboratory',
    description: 'Panels and tests. These become the Lab order dropdown and cashier Laboratory list.',
    template: '/templates/lab-catalog-import-template.csv',
    endpoint: '/laboratory/tests/import',
    countQuery: {
      key: ['lab-tests'],
      path: '/laboratory/tests',
      pick: (data) => (Array.isArray(data) ? data.length : 0),
    },
  },
  {
    id: 'radiology',
    title: 'Radiology',
    description: 'Modalities and studies. These become imaging orders and the cashier Imaging list.',
    template: '/templates/radiology-catalog-import-template.csv',
    endpoint: '/radiology/modalities/import',
    countQuery: {
      key: ['radiology-studies'],
      path: '/radiology/studies',
      pick: (data) => (Array.isArray(data) ? data.length : 0),
    },
  },
  {
    id: 'inventory',
    title: 'Pharmacy & store',
    description: 'SKUs, cost, markup, sell, opening stock. Cashier Pharmacy and prescribe lists use this.',
    template: '/templates/inventory-stock-import-template.csv',
    endpoint: '/inventory/items/import',
    countQuery: {
      key: ['inventory-items'],
      path: '/inventory/items',
      pick: (data) => (Array.isArray(data) ? data.length : 0),
    },
  },
  {
    id: 'theatre',
    title: 'Theatre',
    description: 'Surgical procedures. Theatre booking and Other cashier services can pick from this list.',
    template: '/templates/theatre-procedures-import-template.csv',
    endpoint: '/theatre/procedures/import',
    countQuery: {
      key: ['theatre-procedures'],
      path: '/theatre/procedures',
      pick: (data) => (Array.isArray(data) ? data.length : 0),
    },
  },
  {
    id: 'marketing',
    title: 'Marketing sites & activities',
    description: 'Outreach sites and activity types. Daily report uses these as dropdowns — not free text.',
    template: '/templates/marketing-catalog-import-template.csv',
    endpoint: '/marketing/catalog/import',
    countQuery: {
      key: ['marketing-catalog'],
      path: '/marketing/catalog',
      pick: (data) => {
        const row = data as { sites?: string[]; activities?: string[] }
        return (row.sites?.length ?? 0) + (row.activities?.length ?? 0)
      },
    },
  },
]

function summarize(result: Record<string, unknown>) {
  const parts = Object.entries(result)
    .filter(([key, value]) => key !== 'errors' && key !== 'sites' && key !== 'activities' && typeof value === 'number')
    .map(([key, value]) => `${key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)} ${value}`)
  const errors = Array.isArray(result.errors) ? result.errors.length : 0
  return `${parts.join(' · ') || 'Imported'}${errors ? ` · ${errors} row warning(s)` : ''}`
}

export function ServiceCatalogsHub() {
  const queryClient = useQueryClient()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import service catalogs"
        description="One place to load department lists. After upload, staff pick from dropdowns — they do not type service names."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        {CARDS.map((card) => (
          <CatalogImportCard key={card.id} card={card} onDone={() => queryClient.invalidateQueries()} />
        ))}
      </div>
    </div>
  )
}

function CatalogImportCard({ card, onDone }: { card: ImportCard; onDone: () => void }) {
  const countQuery = useQuery({
    queryKey: card.countQuery.key,
    queryFn: () => apiRequest<unknown>(card.countQuery.path),
    retry: false,
  })
  const count = countQuery.data != null ? card.countQuery.pick(countQuery.data) : null

  const importFile = useMutation({
    mutationFn: (csv: string) =>
      apiRequest<Record<string, unknown>>(card.endpoint, {
        method: 'POST',
        body: JSON.stringify({ csv }),
      }),
    onSuccess: async (result) => {
      notify(`${card.title} imported`, summarize(result), Array.isArray(result.errors) && result.errors.length ? 'warning' : 'success')
      if (Array.isArray(result.errors) && result.errors.length) {
        notify('Some rows need a look', result.errors.slice(0, 3).join(' · '), 'critical')
      }
      await countQuery.refetch()
      onDone()
    },
    onError: (error: Error) => notify(`${card.title} import failed`, error.message, 'critical'),
  })

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{card.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{card.description}</p>
        </div>
        <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-bold tabular-nums text-teal-800">
          {countQuery.isLoading ? '…' : `${count ?? 0} loaded`}
        </span>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            const link = document.createElement('a')
            link.href = card.template
            link.download = card.template.split('/').pop() ?? 'template.csv'
            link.click()
          }}
        >
          <Download className="mr-1.5 h-4 w-4" />
          Template
        </Button>
        <label className="inline-flex cursor-pointer items-center rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700">
          <Upload className="mr-1.5 h-4 w-4" />
          {importFile.isPending ? 'Importing…' : 'Upload CSV'}
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) importFile.mutate(await file.text())
            }}
          />
        </label>
      </div>
    </Card>
  )
}
