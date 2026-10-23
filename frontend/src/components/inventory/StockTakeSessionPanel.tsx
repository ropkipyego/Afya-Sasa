import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, PageHeader, Select } from '../ui'
import { apiRequest, formatApiError } from '../../lib/api'
import { useAuthStore } from '../../lib/auth-store'
import { notify } from '../../lib/notify'
import { readSpreadsheetAsCsv, SPREADSHEET_UPLOAD_ACCEPT } from '../../lib/spreadsheet-import'

type Location = { id: string; name: string; code: string }
type SessionLine = {
  id: string
  sku: string
  name: string
  batchNo: string | null
  expiryDate: string | null
  expectedQty: number
  countedQty: number | null
  varianceQty: number | null
  reason: string | null
}
type Session = {
  id: string
  status: 'open' | 'submitted' | 'rejected' | 'posted'
  baselineAt: string
  submittedBy: string | null
  rejectReason: string | null
  location: { id: string; name: string; code: string } | null
  lines: SessionLine[]
  totals: { lines: number; counted: number; variances: number }
}

export function StockTakeSessionPanel() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)
  const canManage = useAuthStore((s) => (s.user?.permissions ?? []).includes('inventory:manage'))
  const [locationId, setLocationId] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [filter, setFilter] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
  })
  const { data: sessions = [] } = useQuery({
    queryKey: ['inventory-stock-take-sessions'],
    queryFn: () => apiRequest<Session[]>('/inventory/stock-take-sessions'),
  })
  const { data: session, error } = useQuery({
    queryKey: ['inventory-stock-take-session', sessionId],
    queryFn: () => apiRequest<Session>(`/inventory/stock-take-sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  })

  const createSession = useMutation({
    mutationFn: () =>
      apiRequest<Session>('/inventory/stock-take-sessions', {
        method: 'POST',
        body: JSON.stringify({ locationId }),
      }),
    onSuccess: async (created) => {
      setSessionId(created.id)
      notify('Stock-take opened', `${created.totals.lines} lots snapshotted. Counting does not change stock.`, 'success')
      await queryClient.invalidateQueries({ queryKey: ['inventory-stock-take-sessions'] })
    },
    onError: (err: Error) => notify('Could not start stock take', formatApiError(err, err.message), 'critical'),
  })

  const saveCount = useMutation({
    mutationFn: (input: { lineId: string; countedQty: number; reason?: string }) =>
      apiRequest<Session>(`/inventory/stock-take-sessions/${sessionId}/lines/${input.lineId}`, {
        method: 'POST',
        body: JSON.stringify({ countedQty: input.countedQty, reason: input.reason }),
      }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['inventory-stock-take-session', sessionId], updated)
      await queryClient.invalidateQueries({ queryKey: ['inventory-stock-take-sessions'] })
    },
    onError: (err: Error) => notify('Count not saved', formatApiError(err, err.message), 'critical'),
  })

  const submit = useMutation({
    mutationFn: () => apiRequest<Session>(`/inventory/stock-take-sessions/${sessionId}/submit`, { method: 'POST' }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['inventory-stock-take-session', sessionId], updated)
      notify('Submitted for independent approval', 'Another inventory user must approve before stock changes.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['inventory-stock-take-sessions'] })
    },
    onError: (err: Error) => notify('Submit failed', formatApiError(err, err.message), 'critical'),
  })

  const reject = useMutation({
    mutationFn: () =>
      apiRequest<Session>(`/inventory/stock-take-sessions/${sessionId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason }),
      }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['inventory-stock-take-session', sessionId], updated)
      notify('Rejected for recount', 'Baseline is kept. Re-enter counts, then submit again.', 'warning')
      await queryClient.invalidateQueries({ queryKey: ['inventory-stock-take-sessions'] })
    },
    onError: (err: Error) => notify('Reject failed', formatApiError(err, err.message), 'critical'),
  })

  const approve = useMutation({
    mutationFn: () => apiRequest<Session>(`/inventory/stock-take-sessions/${sessionId}/approve`, { method: 'POST' }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['inventory-stock-take-session', sessionId], updated)
      notify('Posted once', `${updated.totals.variances} variance line(s) written to the inventory ledger.`, 'success')
      await queryClient.invalidateQueries({ queryKey: ['inventory-balances'] })
      await queryClient.invalidateQueries({ queryKey: ['inventory-stock-takes'] })
    },
    onError: (err: Error) => notify('Approval blocked', formatApiError(err, err.message), 'critical'),
  })

  const visibleLines = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return session?.lines ?? []
    return (session?.lines ?? []).filter(
      (line) =>
        line.name.toLowerCase().includes(q) ||
        line.sku.toLowerCase().includes(q) ||
        (line.batchNo ?? '').toLowerCase().includes(q),
    )
  }, [filter, session])

  const sameSubmitter = Boolean(session?.submittedBy && userId && session.submittedBy === userId)

  return (
    <Card className="p-6">
      <PageHeader
        title="Stock-take session"
        description="Count physical stock against a frozen baseline. Stock does not change until a different authorised user approves the session."
      />
      {error ? <Alert tone="error" className="mt-3">{formatApiError(error, 'Could not load this stock-take session.')}</Alert> : null}
      {!canManage ? (
        <Alert tone="info" className="mt-3">
          Viewing needs inventory:read. Creating, counting, submitting, rejecting or approving needs inventory:manage.
        </Alert>
      ) : null}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="font-medium text-slate-700">Location</span>
          <Select className="mt-1 min-w-[14rem]" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">Select store</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </Select>
        </label>
        <Button type="button" disabled={!locationId || !canManage} loading={createSession.isPending} onClick={() => createSession.mutate()}>
          Start session
        </Button>
        {sessionId ? (
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              const { accessToken, tenant } = useAuthStore.getState()
              const response = await fetch(`/api/v1/inventory/stock-take-sessions/${sessionId}/sheet`, {
                headers: {
                  Authorization: accessToken ? `Bearer ${accessToken}` : '',
                  'X-Tenant': tenant,
                },
                credentials: 'include',
              })
              if (!response.ok) {
                notify('Could not download count sheet', 'Open a session and try again.', 'critical')
                return
              }
              const blob = await response.blob()
              const link = document.createElement('a')
              link.href = URL.createObjectURL(blob)
              link.download = 'physical-count-sheet.csv'
              link.click()
              URL.revokeObjectURL(link.href)
            }}
          >
            Download physical count sheet
          </Button>
        ) : null}
        {sessionId && canManage ? (
          <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Import completed counts
            <input
              type="file"
              accept={SPREADSHEET_UPLOAD_ACCEPT}
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                try {
                  const csv = await readSpreadsheetAsCsv(file)
                  const updated = await apiRequest<Session & { imported?: number; errors?: string[] }>(
                    `/inventory/stock-take-sessions/${sessionId}/import-counts`,
                    { method: 'POST', body: JSON.stringify({ csv }) },
                  )
                  queryClient.setQueryData(['inventory-stock-take-session', sessionId], updated)
                  notify(
                    'Counts imported',
                    `${updated.imported ?? 0} line(s) saved. Stock is unchanged until independent approval.`,
                    updated.errors?.length ? 'warning' : 'success',
                  )
                } catch (error) {
                  notify(
                    'Import did not post stock',
                    formatApiError(error, error instanceof Error ? error.message : 'Check the sheet and session.'),
                    'critical',
                  )
                }
              }}
            />
          </label>
        ) : null}
        <label className="text-sm">
          <span className="font-medium text-slate-700">Open session</span>
          <Select className="mt-1 min-w-[16rem]" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            <option value="">Select session</option>
            {sessions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.location?.name ?? 'Store'} · {row.status} · {row.id.slice(0, 8)}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {session ? (
        <div className="mt-5 space-y-4">
          <p className="text-sm text-slate-600">
            Status <strong>{session.status}</strong> · baseline {new Date(session.baselineAt).toLocaleString()} ·{' '}
            {session.totals.counted}/{session.totals.lines} counted · {session.totals.variances} variance(s)
          </p>
          {session.rejectReason ? <Alert tone="warning">Last reject: {session.rejectReason}</Alert> : null}
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Filter by name, SKU or batch / barcode"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2">Item</th>
                  <th className="pb-2">Batch</th>
                  <th className="pb-2">Expected</th>
                  <th className="pb-2">Counted</th>
                  <th className="pb-2">Variance</th>
                  <th className="pb-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {visibleLines.map((line) => (
                  <CountRow
                    key={line.id}
                    line={line}
                    disabled={!canManage || session.status === 'submitted' || session.status === 'posted'}
                    onSave={(countedQty, reason) => saveCount.mutate({ lineId: line.id, countedQty, reason })}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!canManage || (session.status !== 'open' && session.status !== 'rejected')}
              loading={submit.isPending}
              onClick={() => submit.mutate()}
            >
              Submit for review
            </Button>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Reject reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={!canManage || session.status !== 'submitted'}
              loading={reject.isPending}
              onClick={() => reject.mutate()}
            >
              Reject / recount
            </Button>
            <Button
              type="button"
              disabled={!canManage || session.status !== 'submitted' || sameSubmitter}
              loading={approve.isPending}
              onClick={() => approve.mutate()}
            >
              Approve and post
            </Button>
          </div>
          {sameSubmitter && session.status === 'submitted' ? (
            <Alert tone="warning">You submitted this count. Another inventory:manage user must approve it.</Alert>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Start or select a session. Counting never posts stock by itself.</p>
      )}
    </Card>
  )
}

function CountRow({
  line,
  disabled,
  onSave,
}: {
  line: SessionLine
  disabled: boolean
  onSave: (countedQty: number, reason?: string) => void
}) {
  const [counted, setCounted] = useState(line.countedQty == null ? '' : String(line.countedQty))
  const [reason, setReason] = useState(line.reason ?? '')
  const variance =
    counted === '' ? line.varianceQty : Number(counted) - line.expectedQty
  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 pr-3">
        <div className="font-medium">{line.name}</div>
        <div className="font-mono text-xs text-slate-500">{line.sku}</div>
      </td>
      <td className="py-2 pr-3">
        {line.batchNo ?? '—'}
        <div className="text-xs text-slate-500">{line.expiryDate ?? 'no expiry'}</div>
      </td>
      <td className="py-2 pr-3 tabular-nums">{line.expectedQty}</td>
      <td className="py-2 pr-3">
        <input
          className="w-24 rounded border border-slate-200 px-2 py-1"
          type="number"
          min={0}
          disabled={disabled}
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
          onBlur={() => {
            if (disabled || counted === '') return
            onSave(Number(counted), reason)
          }}
        />
      </td>
      <td className="py-2 pr-3 tabular-nums">{variance == null || Number.isNaN(Number(variance)) ? '—' : variance}</td>
      <td className="py-2">
        <input
          className="w-full min-w-[10rem] rounded border border-slate-200 px-2 py-1"
          disabled={disabled}
          placeholder={variance && Number(variance) !== 0 ? 'Required' : 'Optional'}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => {
            if (disabled || counted === '') return
            onSave(Number(counted), reason)
          }}
        />
      </td>
    </tr>
  )
}
