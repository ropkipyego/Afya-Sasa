import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Button, Card, Field, PageHeader, SelectField } from '../ui'
import { DEPARTMENT_EXPORTS, downloadDepartmentExport } from '../../lib/exports'
import { useAuthStore } from '../../lib/auth-store'
import { notify } from '../../lib/notify'
import { formatApiError } from '../../lib/api'

export function DepartmentExportsPanel({ initialDataset }: { initialDataset?: string } = {}) {
  const permissions = useAuthStore((state) => state.user?.permissions ?? [])
  const allowed = useMemo(
    () => DEPARTMENT_EXPORTS.filter((row) => permissions.includes(row.permission)),
    [permissions],
  )
  const [dataset, setDataset] = useState(initialDataset && allowed.some((row) => row.dataset === initialDataset)
    ? initialDataset
    : allowed[0]?.dataset ?? 'opd')
  const [format, setFormat] = useState<'csv' | 'xlsx'>('xlsx')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)

  const selected = allowed.find((row) => row.dataset === dataset)
  const run = async () => {
    const range = from && to ? ` for ${from} to ${to}` : from ? ` from ${from}` : to ? ` to ${to}` : ''
    if (!window.confirm(`Export ${selected?.label ?? dataset} records${range} as ${format.toUpperCase()}? The server will audit this download.`)) {
      return
    }
    setBusy(true)
    try {
      await downloadDepartmentExport({ dataset, format, from: from || undefined, to: to || undefined })
      notify('Export ready', `${dataset.toUpperCase()} ${format.toUpperCase()} downloaded.`, 'success')
    } catch (error) {
      notify('Export failed', formatApiError(error, 'Could not export this dataset.'), 'critical')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5 md:p-8">
      <PageHeader
        title="Department exports"
        description="Download the same departmental records your role can already view. The server checks permission and writes an audit event."
      />
      {allowed.length ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <SelectField
            name="dataset"
            label="Dataset"
            value={dataset}
            onChange={(e) => setDataset(e.target.value as (typeof allowed)[number]['dataset'])}
          >
            {allowed.map((row) => (
              <option key={row.dataset} value={row.dataset}>
                {row.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            name="format"
            label="Format"
            value={format}
            onChange={(e) => setFormat(e.target.value as 'csv' | 'xlsx')}
          >
            <option value="xlsx">Excel (XLSX)</option>
            <option value="csv">CSV (UTF-8)</option>
          </SelectField>
          <Field name="from" label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Field name="to" label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <div className="md:col-span-2">
            <Button type="button" onClick={() => void run()} loading={busy} disabled={busy}>
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-600">No department export is available for this account.</p>
      )}
    </Card>
  )
}
