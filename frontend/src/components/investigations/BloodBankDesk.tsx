import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Field, SelectField, TextareaField } from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'
import { formatPatientNoShort } from '../../lib/patient-utils'

type StockSummary = {
  available: boolean
  reason?: string
  generatedAt?: string
  lastStockUpdate?: string | null
  physicalOnHand?: number
  availableForIssue?: number
  reserved?: number
  issuedInPeriod?: number
  quarantinedOrAwaitingScreening?: number
  expired?: number
  nearingExpiry?: number
  byGroup?: Record<string, number>
  requestWorkload?: { openRequests: number; issuedRequestsInPeriod: number }
  definitions?: Record<string, string>
}

type BloodRow = {
  id: string
  requestNo: string
  status: string
  product: string
  units: string
  patientBloodGroup?: string | null
  indication?: string | null
  groupingResult?: string | null
  crossmatchResult?: string | null
  patient?: { firstName: string; lastName: string; patientNo: string }
}

export function BloodBankDesk() {
  const queryClient = useQueryClient()
  const [patient, setPatient] = useState<PatientSearchItem | null>(null)
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['blood-bank-requests'],
    queryFn: () => apiRequest<BloodRow[]>('/laboratory/blood-bank'),
    refetchInterval: 20_000,
  })
  const { data: stock, isError: stockError } = useQuery({
    queryKey: ['blood-bank-stock'],
    queryFn: () => apiRequest<StockSummary>('/laboratory/blood-bank/stock'),
    refetchInterval: 20_000,
    retry: false,
  })

  const create = useMutation({
    mutationFn: (form: HTMLFormElement) => {
      const data = new FormData(form)
      if (!patient?.id) throw new Error('Select a patient first.')
      return apiRequest('/laboratory/blood-bank', {
        method: 'POST',
        body: JSON.stringify({
          patientId: patient.id,
          product: data.get('product'),
          units: Number(data.get('units')),
          patientBloodGroup: data.get('patientBloodGroup') || undefined,
          indication: data.get('indication') || undefined,
        }),
      })
    },
    onSuccess: async () => {
      notify('Blood bank request recorded', 'This is a laboratory request, not pharmacy stock.', 'success')
      setPatient(null)
      await queryClient.invalidateQueries({ queryKey: ['blood-bank-requests'] })
    },
    onError: (error: Error) => notify('Blood bank request failed', error.message, 'critical'),
  })

  const updateStatus = useMutation({
    mutationFn: (input: { id: string; status: string; groupingResult?: string; crossmatchResult?: string }) =>
      apiRequest(`/laboratory/blood-bank/${input.id}/status`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['blood-bank-requests'] })
    },
    onError: (error: Error) => notify('Update failed', error.message, 'critical'),
  })

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Blood unit stock</p>
        {stockError ? (
          <Alert tone="warning">Stock dashboard could not be loaded. Totals are not shown as zero.</Alert>
        ) : null}
        {stock && stock.available === false ? (
          <Alert tone="info">
            {stock.reason} Open requests: {stock.requestWorkload?.openRequests ?? 0}. Issued requests in
            period: {stock.requestWorkload?.issuedRequestsInPeriod ?? 0}. Those are requests, not fridge
            units.
          </Alert>
        ) : null}
        {stock?.available ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['On hand', stock.physicalOnHand],
              ['Available to issue', stock.availableForIssue],
              ['Reserved', stock.reserved],
              ['Issued (period)', stock.issuedInPeriod],
              ['Quarantine / unscreened', stock.quarantinedOrAwaitingScreening],
              ['Expired on shelf', stock.expired],
              ['Nearing expiry (7d)', stock.nearingExpiry],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
                <p className="text-lg font-semibold tabular-nums text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        ) : null}
        {stock?.available && stock.byGroup ? (
          <p className="mt-2 text-xs text-slate-600">
            On-hand by group:{' '}
            {Object.entries(stock.byGroup)
              .map(([group, count]) => `${group} ${count}`)
              .join(' · ') || 'none'}
            {stock.lastStockUpdate
              ? ` · last unit update ${new Date(stock.lastStockUpdate).toLocaleString('en-KE')}`
              : ''}
          </p>
        ) : null}
        <p className="mt-2 text-[11px] text-slate-500">
          Receipt is not a release. Available stock excludes expired, quarantined, unscreened, reserved and
          issued units. Compatibility is not calculated here.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Blood bank — laboratory</p>
        <p className="mt-1 text-xs text-slate-600">
          Grouping, crossmatch and authorised issue. Units are not pharmacy lots. Record the laboratory
          result the bench actually obtained. Issue requires verification permission and both results.
        </p>
        <div className="mt-4">
          <PatientSearchAutocomplete selected={patient} onSelect={setPatient} />
        </div>
        {patient ? (
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              create.mutate(event.currentTarget)
            }}
          >
            <SelectField name="product" label="Product" required>
              <option value="packed_red_cells">Packed red cells</option>
              <option value="whole_blood">Whole blood</option>
              <option value="ffp">Fresh frozen plasma</option>
              <option value="platelets">Platelets</option>
              <option value="cryoprecipitate">Cryoprecipitate</option>
            </SelectField>
            <Field name="units" label="Units" type="number" min={1} max={20} required defaultValue="1" />
            <Field name="patientBloodGroup" label="Known blood group" placeholder="e.g. O+" />
            <div className="sm:col-span-2">
              <TextareaField name="indication" label="Clinical indication" rows={2} />
            </div>
            <Button type="submit" loading={create.isPending}>
              Record request
            </Button>
          </form>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Open blood bank work</p>
        {isLoading ? <p className="mt-2 text-sm text-slate-500">Loading…</p> : null}
        {!isLoading && !rows.length ? (
          <p className="mt-2 text-sm text-slate-500">No blood bank requests yet.</p>
        ) : null}
        <ul className="mt-3 divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                {row.requestNo} · {row.patient?.firstName} {row.patient?.lastName}{' '}
                {row.patient?.patientNo ? `(${formatPatientNoShort(row.patient.patientNo)})` : ''} · {row.product} ×{' '}
                {row.units} · {row.status}
              </span>
              {row.status !== 'issued' && row.status !== 'cancelled' ? (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const data = new FormData(event.currentTarget)
                    updateStatus.mutate({
                      id: row.id,
                      status: String(data.get('status')),
                      groupingResult: String(data.get('groupingResult') || ''),
                      crossmatchResult: String(data.get('crossmatchResult') || ''),
                    })
                  }}
                >
                  <input
                    name="groupingResult"
                    defaultValue={row.groupingResult ?? ''}
                    placeholder="Grouping"
                    className="w-24 rounded border border-slate-200 px-2 py-1 text-xs"
                    aria-label="Grouping result"
                  />
                  <input
                    name="crossmatchResult"
                    defaultValue={row.crossmatchResult ?? ''}
                    placeholder="Crossmatch"
                    className="w-28 rounded border border-slate-200 px-2 py-1 text-xs"
                    aria-label="Crossmatch result"
                  />
                  <select name="status" className="rounded border border-slate-200 px-2 py-1 text-xs" defaultValue={row.status === 'requested' ? 'grouped' : row.status === 'grouped' ? 'crossmatched' : 'issued'}>
                    {row.status === 'requested' ? <option value="grouped">Grouped</option> : null}
                    {row.status === 'grouped' ? <option value="crossmatched">Crossmatched</option> : null}
                    {row.status === 'crossmatched' ? <option value="issued">Issue (verify)</option> : null}
                    <option value="cancelled">Cancel</option>
                  </select>
                  <Button type="submit" className="px-2 py-1 text-xs" loading={updateStatus.isPending}>
                    Save
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
