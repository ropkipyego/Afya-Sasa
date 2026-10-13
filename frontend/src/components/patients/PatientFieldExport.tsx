import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Field, PageHeader } from '../ui'
import { apiRequest, formatApiError } from '../../lib/api'
import { notify } from '../../lib/notify'
import { downloadPatientFieldExport } from '../../lib/exports'

type FieldDef = { key: string; label: string; sensitive: boolean }

export function PatientFieldExport() {
  const [selected, setSelected] = useState<string[]>(['patientNo', 'gender', 'county'])
  const [q, setQ] = useState('')
  const fieldsQuery = useQuery({
    queryKey: ['patient-export-fields'],
    queryFn: () => apiRequest<FieldDef[]>('/exports/patients/fields'),
  })
  const previewQuery = useQuery({
    queryKey: ['patient-export-preview', selected, q],
    queryFn: () =>
      apiRequest<{ total: number; rowCount: number; rows: Array<Record<string, unknown>> }>(
        `/exports/patients/preview?fields=${encodeURIComponent(selected.join(','))}&q=${encodeURIComponent(q)}`,
      ),
    enabled: selected.length > 0,
  })

  const fields = fieldsQuery.data ?? []
  const preview = previewQuery.data
  const sampleKeys = useMemo(() => selected, [selected])

  const download = async (format: 'csv' | 'xlsx') => {
    try {
      await downloadPatientFieldExport({ fields: selected, format, q: q.trim() || undefined })
      notify('Export started', `${preview?.total ?? 0} matching records, selected columns only.`, 'success')
    } catch (error) {
      notify('Export failed', formatApiError(error, 'Could not export patients.'), 'critical')
    }
  }

  return (
    <Card className="mt-8 p-5">
      <PageHeader
        title="Patient Centre field export"
        description="Requires patients:read and reports:read. Passwords and clinical results are not available in this export."
      />
      <div className="mt-4">
        <Field name="q" label="Filter" value={q} onChange={(event) => setQ(event.target.value)} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(field.key)}
              onChange={() =>
                setSelected((current) =>
                  current.includes(field.key) ? current.filter((key) => key !== field.key) : [...current, field.key],
                )
              }
            />
            {field.label}
            {field.sensitive ? <span className="text-xs text-amber-700">sensitive</span> : null}
          </label>
        ))}
      </div>
      <p className="mt-3 text-sm text-slate-600">Matching records: {preview?.total ?? '—'}</p>
      <div className="mt-3 overflow-x-auto text-sm">
        <table className="min-w-full">
          <thead>
            <tr>
              {sampleKeys.map((key) => (
                <th key={key} className="px-2 py-1 text-left text-xs uppercase text-slate-500">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(preview?.rows ?? []).slice(0, 8).map((row, index) => (
              <tr key={index}>
                {sampleKeys.map((key) => (
                  <td key={key} className="px-2 py-1">
                    {String(row[key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex gap-2">
        <Button type="button" onClick={() => void download('csv')}>
          Download CSV
        </Button>
        <Button type="button" variant="secondary" onClick={() => void download('xlsx')}>
          Download XLSX
        </Button>
      </div>
    </Card>
  )
}
