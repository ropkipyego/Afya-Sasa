import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Upload } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, Field, PageHeader } from '../../ui'
import { apiRequest } from '../../../lib/api'
import { notify } from '../../../lib/notify'

type AuditItem = {
  id: string
  action: string
  endpoint: string
  httpCode: number
  recordType?: string | null
  recordId?: string | null
  userId?: string | null
  beforeJson?: Record<string, unknown> | null
  afterJson?: Record<string, unknown> | null
  createdAt: string
}

export function AuditLogPanel() {
  const queryClient = useQueryClient()
  const [patientId, setPatientId] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data } = useQuery({
    queryKey: ['audit-logs', actionFilter],
    queryFn: () =>
      apiRequest<{ items: AuditItem[]; meta: { total: number } }>(
        `/admin/audit-logs?pageSize=50${actionFilter ? `&action=${encodeURIComponent(actionFilter)}` : ''}`,
      ),
  })

  const { data: phiReport } = useQuery({
    queryKey: ['phi-access-report', patientId],
    queryFn: () =>
      apiRequest<{
        items: {
          id: string
          userId: string | null
          endpoint: string
          recordId: string | null
          createdAt: string
        }[]
        meta: { total: number }
      }>(`/admin/phi-access-report?${patientId ? `patientId=${encodeURIComponent(patientId)}&` : ''}pageSize=25`),
  })

  const importAudit = useMutation({
    mutationFn: (csv: string) =>
      apiRequest<{ imported: number; skipped: number }>('/admin/audit-logs/import', {
        method: 'POST',
        body: JSON.stringify({ csv }),
      }),
    onSuccess: async (result) => {
      notify('Audit import', `Imported ${result.imported}, skipped ${result.skipped}`, 'success')
      await queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
    },
    onError: (error: Error) => notify('Import failed', error.message, 'critical'),
  })

  const exportCsv = async () => {
    const token = (await import('../../../lib/auth-store')).useAuthStore.getState().accessToken
    const tenant = (await import('../../../lib/auth-store')).useAuthStore.getState().tenant
    const base = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
    const response = await fetch(`${base}/admin/audit-logs/export`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant': tenant,
      },
    })
    if (!response.ok) {
      notify('Export failed', 'Could not download audit CSV', 'critical')
      return
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <Card className="p-8">
        <PageHeader
          title="Audit logs"
          description="Full compliance trail — filters, before/after snapshots, CSV export and import."
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="text-sm">
            <span className="font-semibold">Action</span>
            <select
              className="input mt-1 block"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="create">create</option>
              <option value="update">update</option>
              <option value="read">read</option>
              <option value="delete">delete</option>
              <option value="export">export</option>
              <option value="import">import</option>
            </select>
          </label>
          <Button type="button" variant="secondary" onClick={() => void exportCsv()}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Upload className="h-4 w-4" />
            {importAudit.isPending ? 'Importing…' : 'Import CSV'}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                importAudit.mutate(await file.text())
                e.target.value = ''
              }}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">{data?.meta.total ?? 0} events total</p>
        <div className="mt-6 divide-y divide-slate-100">
          {(data?.items ?? []).map((entry) => (
            <div key={entry.id} className="py-3 text-sm">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                <p className="font-semibold">
                  {entry.action.toUpperCase()} · {entry.httpCode}
                  {entry.recordType ? ` · ${entry.recordType}` : ''}
                </p>
                <p className="text-slate-500">{entry.endpoint}</p>
                <p className="text-xs text-slate-400">
                  {new Date(entry.createdAt).toLocaleString()}
                  {entry.userId ? ` · user ${entry.userId.slice(0, 8)}…` : ''}
                </p>
              </button>
              {expandedId === entry.id ? (
                <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 text-xs md:grid-cols-2">
                  <div>
                    <p className="font-bold text-slate-600">Before</p>
                    <pre className="mt-1 overflow-auto whitespace-pre-wrap">
                      {entry.beforeJson ? JSON.stringify(entry.beforeJson, null, 2) : '—'}
                    </pre>
                  </div>
                  <div>
                    <p className="font-bold text-slate-600">After</p>
                    <pre className="mt-1 overflow-auto whitespace-pre-wrap">
                      {entry.afterJson ? JSON.stringify(entry.afterJson, null, 2) : '—'}
                    </pre>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
          {!data?.items?.length ? (
            <p className="py-12 text-center text-sm text-slate-500">No audit events recorded yet.</p>
          ) : null}
        </div>
      </Card>

      <Card className="p-8">
        <PageHeader
          title="PHI access report"
          description="Who opened patient charts — filter by patient UUID for investigations."
        />
        <div className="mt-4 max-w-md">
          <Field
            name="patientId"
            label="Patient ID (optional)"
            value={patientId}
            onChange={(event) => setPatientId(event.target.value)}
            placeholder="Paste patient UUID to filter"
          />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {phiReport?.meta.total ?? 0} chart access events recorded
        </p>
        <div className="mt-4 divide-y divide-slate-100">
          {(phiReport?.items ?? []).map((entry) => (
            <div key={entry.id} className="py-3 text-sm">
              <p className="font-semibold">READ · {entry.recordId ?? 'patient record'}</p>
              <p className="text-slate-500">{entry.endpoint}</p>
              <p className="text-xs text-slate-400">
                User {entry.userId ?? '—'} · {new Date(entry.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
