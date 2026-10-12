import { useQuery } from '@tanstack/react-query'
import { Alert, Card, PageHeader } from '../ui'
import { apiRequest, formatApiError } from '../../lib/api'
import { useAuthStore } from '../../lib/auth-store'

type CatalogueItem = {
  id: string
  category: string
  title: string
  description: string
  permission: string
  path: string
  screen: string
  implemented: boolean
  source: string
  finance?: boolean
  available: boolean
}

type CatalogueResponse = {
  generatedAt: string
  timezone: string
  items: CatalogueItem[]
}

export function ReportsCataloguePanel({ onOpenAnalytics }: { onOpenAnalytics: () => void }) {
  const permissions = useAuthStore((state) => state.user?.permissions ?? [])
  const { data, error, isLoading } = useQuery({
    queryKey: ['reports-catalogue'],
    queryFn: () => apiRequest<CatalogueResponse>('/reports/catalogue'),
    enabled: permissions.includes('reports:read'),
  })

  if (!permissions.includes('reports:read')) {
    return (
      <Alert tone="warning">
        This Reports Centre requires reports:read. Ask an administrator to assign a director or reporting role.
      </Alert>
    )
  }

  const items = data?.items ?? []
  const categories = Array.from(new Set(items.map((row) => row.category)))

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <PageHeader
          title="Reports Centre"
          description="Catalogued reports already implemented in AfyaSasa. Missing categories stay empty rather than inventing figures. Finance exports still require payments:read."
        />
        <p className="mt-2 text-xs text-slate-500">
          Timezone {data?.timezone ?? 'Africa/Nairobi'}
          {data?.generatedAt ? ` · generated ${new Date(data.generatedAt).toLocaleString()}` : ''}
        </p>
      </Card>
      {isLoading ? <p className="text-sm text-slate-500">Loading catalogue…</p> : null}
      {error ? <Alert tone="error">{formatApiError(error, 'Unable to load the reports catalogue.')}</Alert> : null}
      {categories.map((category) => (
        <section key={category}>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">{category}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {items
              .filter((row) => row.category === category)
              .map((row) => (
                <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">{row.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{row.description}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Permission: {row.permission} · Source: {row.source}
                  </p>
                  {row.available ? (
                    <button
                      type="button"
                      className="mt-3 text-sm font-semibold text-teal-800"
                      onClick={() => {
                        if (row.id === 'executive-analytics' || row.id === 'intelligence') {
                          onOpenAnalytics()
                          return
                        }
                        window.dispatchEvent(new CustomEvent('afyasasa:navigate', { detail: row.screen }))
                      }}
                    >
                      Open {row.screen}
                    </button>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      {row.implemented
                        ? 'Not available for this account.'
                        : 'Not implemented. No placeholder figures are shown.'}
                    </p>
                  )}
                </article>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}
