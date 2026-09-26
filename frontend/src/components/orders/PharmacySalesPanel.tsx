import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, PageHeader } from '../ui'
import { formatConfiguredPrice } from '../../lib/clinical-catalog'
import { listRecentPayments, type PaymentTransactionRow } from '../../lib/payments'

type Range = 'today' | '7d' | '30d'

function startFor(range: Range) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  if (range === '7d') date.setDate(date.getDate() - 6)
  if (range === '30d') date.setDate(date.getDate() - 29)
  return date.getTime()
}

function amountOf(row: PaymentTransactionRow) {
  const value = Number(row.amount)
  return Number.isFinite(value) ? value : 0
}

export function PharmacySalesPanel({ mode = 'all' }: { mode?: 'all' | 'unpaid' | 'payments' }) {
  const [range, setRange] = useState<Range>('today')
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['payments-recent', 'pharmacy-sales'],
    queryFn: () => listRecentPayments(200),
  })

  const pharmacy = useMemo(
    () => data.filter((row) => row.serviceLine === 'pharmacy'),
    [data],
  )

  const rows = useMemo(() => {
    const from = startFor(range)
    return pharmacy.filter((row) => new Date(row.createdAt).getTime() >= from)
  }, [pharmacy, range])

  const completed = rows.filter((row) => row.status === 'completed')
  const pending = rows.filter((row) => row.status === 'pending' || row.status === 'initiated')
  const byMethod = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of completed) {
      map.set(row.method, (map.get(row.method) ?? 0) + amountOf(row))
    }
    return [...map.entries()]
  }, [completed])

  const visible = mode === 'unpaid' ? pending : rows

  return (
    <Card className="p-6">
      <PageHeader
        title={mode === 'unpaid' ? 'Unpaid pharmacy sales' : 'Pharmacy sales'}
        description="From the existing payment ledger. No second accounts book."
      />
      <div className="mt-4 flex flex-wrap gap-2">
        {(['today', '7d', '30d'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRange(value)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              range === value ? 'bg-teal-700 text-white' : 'border border-slate-200 bg-white'
            }`}
          >
            {value === 'today' ? 'Today' : value === '7d' ? '7 days' : '30 days'}
          </button>
        ))}
      </div>
      {error ? <p className="mt-4 text-sm text-rose-700">{(error as Error).message}</p> : null}
      {isLoading ? <div className="mt-6 h-32 animate-skeleton rounded-xl" /> : null}
      {!isLoading && !error ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Tile label="Collected" value={formatConfiguredPrice(completed.reduce((sum, row) => sum + amountOf(row), 0)) ?? 'No collections'} />
            <Tile label="Completed payments" value={String(completed.length)} />
            <Tile label="Initiated / pending" value={String(pending.length)} />
          </div>
          {byMethod.length ? (
            <ul className="mt-4 text-sm text-slate-700">
              {byMethod.map(([method, total]) => (
                <li key={method}>
                  {method.toUpperCase()} · {formatConfiguredPrice(total) ?? '—'}
                </li>
              ))}
            </ul>
          ) : null}
          {visible.length ? (
            <table className="mt-5 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3">When</th>
                  <th className="pb-2 pr-3">Patient</th>
                  <th className="pb-2 pr-3">Description</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, 40).map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 text-xs">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-3">
                      {row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : '—'}
                    </td>
                    <td className="py-2 pr-3">{row.serviceDescription ?? 'Pharmacy'}</td>
                    <td className="py-2 pr-3">{row.status}</td>
                    <td className="py-2">{formatConfiguredPrice(amountOf(row)) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">
              {mode === 'unpaid'
                ? 'No initiated or pending pharmacy payments in this window.'
                : 'No pharmacy payments in this window.'}
            </p>
          )}
        </>
      ) : null}
    </Card>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}
