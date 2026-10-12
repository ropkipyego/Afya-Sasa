import { useMemo, useState } from 'react'
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
  available: boolean
  finance?: boolean
}

type CatalogueResponse = {
  generatedAt: string
  timezone: string
  items: CatalogueItem[]
}

export function ReportsCatalogue({
  onOpenAnalytics,
  onOpenOperations,
}: {
  onOpenAnalytics?: () => void
  onOpenOperations?: () => void
} = {}) {
  const permissions = useAuthStore((state) => state.user?.permissions ?? [])
  const canRead = permissions.includes('reports:read')
  const [category, setCategory] = useState('')
  const { data, isLoading, error } = useQuery({
    queryKey: ['reports-catalogue'],
    queryFn: () => apiRequest<CatalogueResponse>('/reports/catalogue'),
    enabled: canRead,
  })

  const categories = useMemo(
    () => Array.from(new Set((data?.items ?? []).map((row) => row.category))),
    [data],
  )
  const rows = (data?.items ?? []).filter((row) => !category || row.category === category)

  if (!canRead) {
    return (
      <Card className="p-6">
        <PageHeader title="Reports Centre" description="This account does not have reports:read." />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <PageHeader
          title="Reports Centre"
          description="Catalogued reports from existing APIs and screens. Unimplemented categories stay empty rather than inventing figures."
        />
        {data ? (
          <p className="mt-2 text-xs text-slate-500">
            Generated {new Date(data.generatedAt).toLocaleString()} · Time zone {data.timezone}
          </p>
        ) : null}
        <label className="mt-4 block max-w-md text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</span>
          <select className="input mt-1" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </Card>
      {isLoading ? <p className="text-sm text-slate-500">Loading catalogue…</p> : null}
      {error ? <Alert tone="error">{formatApiError(error, 'Unable to load the reports catalogue.')}</Alert> : null}
      {rows.map((row) => (
        <Card key={row.id} className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.category}</p>
          <h3 className="mt-1 text-lg font-bold text-slate-900">{row.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{row.description}</p>
          <p className="mt-2 text-xs text-slate-500">
            Permission <code>{row.permission}</code> · Source {row.source}
          </p>
          {row.available ? (
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-teal-700"
              onClick={() => {
                if (row.id === 'executive-analytics' || row.id === 'intelligence') {
                  onOpenAnalytics?.()
                  return
                }
                if (row.id === 'operations' || row.id === 'specialty') {
                  onOpenOperations?.()
                  return
                }
                window.dispatchEvent(new CustomEvent('afyasasa:navigate', { detail: row.screen }))
              }}
            >
              Open {row.screen}
            </button>
          ) : (
            <p className="mt-3 text-sm text-amber-800">
              {row.implemented
                ? 'This report exists, but the current account is missing the dataset permission.'
                : 'Not implemented from a trustworthy source yet. No placeholder figures.'}
            </p>
          )}
        </Card>
      ))}
    </div>
  )
}
