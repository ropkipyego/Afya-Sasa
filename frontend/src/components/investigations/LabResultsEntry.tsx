import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { CheckCircle2, Calculator, FileUp, Search } from 'lucide-react'
import { Button, Field, SelectField } from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'
import { formDataFromElement } from '../../lib/form-utils'
import { uploadClinicalFile, viewClinicalFile } from '../../lib/clinical-upload'
import {
  LabEmptyState,
  LabFlagBadge,
  LabModal,
  LabPatientStrip,
  LabQueueItem,
  LabSection,
  waitLabel,
} from './lab-ui'

type RefRange = {
  gender: string
  ageMinDays?: number | null
  ageMaxDays?: number | null
  rangeLow?: string | number | null
  rangeHigh?: string | number | null
  normalTextValue?: string | null
}

type CatalogParameter = {
  id: string
  code: string
  name: string
  unit?: string | null
  resultDataType: string
  selectOptions?: string[] | null
  calculatedFormula?: string | null
  orderIndex: number
  referenceRanges?: RefRange[]
}

type SavedLabResult = {
  id: string
  value: string
  unit?: string | null
  flag: string
  referenceRange?: string | null
  isCritical?: boolean
  parameter?: { id: string; code: string; name: string } | null
}

type LabRequestItem = {
  id: string
  test?: { name: string }
  panel?: { name: string }
  orderableTest?: {
    id: string
    code: string
    name: string
    isPanel: boolean
    parameters?: CatalogParameter[]
  } | null
  results?: SavedLabResult[]
}

type LabRequestRow = {
  id: string
  status: string
  priority: string
  createdAt: string
  patient?: {
    firstName: string
    lastName: string
    patientNo: string
    dateOfBirth?: string
    gender?: string
  }
  items?: LabRequestItem[]
  attachments?: { id: string; filename: string; title?: string | null; storagePath: string }[]
}

type EvaluateResponse = {
  derived: Array<{ parameterCode: string; value: string | number }>
  flagged: Array<{
    parameterCode: string
    flag: string
    legacyFlag?: string
    referenceRangeLabel?: string
  }>
}

function itemLabel(item: LabRequestItem) {
  return item.orderableTest?.name ?? item.test?.name ?? item.panel?.name ?? item.id
}

function requestTestSummary(items?: LabRequestItem[]) {
  if (!items?.length) return undefined
  const names = items.map(itemLabel)
  if (names.length <= 2) return names.join(' · ')
  return `${names.slice(0, 2).join(' · ')} +${names.length - 2}`
}

function toCatalogPatient(patient: { dateOfBirth?: string; gender?: string }) {
  const gender: 'M' | 'F' = patient.gender === 'male' ? 'M' : 'F'
  const ageDays = patient.dateOfBirth
    ? Math.max(0, Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / 86_400_000))
    : 365 * 30
  return { gender, ageDays }
}

function formatRefHint(ranges?: RefRange[]) {
  if (!ranges?.length) return undefined
  const range = ranges.find((row) => row.gender === 'ALL') ?? ranges[0]
  if (range.normalTextValue) return `Ref: ${range.normalTextValue}`
  if (range.rangeLow != null && range.rangeHigh != null) {
    return `Ref: ${range.rangeLow}–${range.rangeHigh}`
  }
  if (range.rangeLow != null) return `Ref: ≥ ${range.rangeLow}`
  if (range.rangeHigh != null) return `Ref: ≤ ${range.rangeHigh}`
  return undefined
}

function ParameterField({
  parameter,
  value,
  onChange,
  refHint,
  previewFlag,
  derivedPreview,
}: {
  parameter: CatalogParameter
  value: string
  onChange: (value: string) => void
  refHint?: string
  previewFlag?: string | null
  derivedPreview?: string | number | null
}) {
  const label = parameter.name
  const unitHint = [parameter.unit, refHint].filter(Boolean).join(' · ') || undefined

  if (parameter.calculatedFormula) {
    return (
      <div className="lab-param-calculated flex items-center justify-between gap-2 rounded-xl border border-dashed border-teal-200 bg-teal-50/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 shrink-0 text-teal-600" />
          <div>
            <p className="text-sm font-medium text-slate-800">{label}</p>
            <p className="text-xs text-teal-700">Auto-calculated after entry</p>
          </div>
        </div>
        <div className="text-right">
          {derivedPreview != null && derivedPreview !== '' ? (
            <p className="text-sm font-semibold tabular-nums text-slate-900">
              {derivedPreview}
              {parameter.unit ? ` ${parameter.unit}` : ''}
            </p>
          ) : null}
          {previewFlag ? <LabFlagBadge flag={previewFlag} /> : null}
        </div>
      </div>
    )
  }

  const fieldFooter =
    previewFlag && previewFlag !== 'normal' ? (
      <div className="mt-1">
        <LabFlagBadge flag={previewFlag} />
      </div>
    ) : null

  if (parameter.resultDataType === 'select_options' && parameter.selectOptions?.length) {
    return (
      <div>
        <SelectField
          name={parameter.code}
          label={label}
          hint={unitHint}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {parameter.selectOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectField>
        {fieldFooter}
      </div>
    )
  }

  const isNumeric = parameter.resultDataType === 'numeric'

  return (
    <div>
      <Field
        name={parameter.code}
        label={label}
        hint={unitHint}
        type={isNumeric ? 'number' : 'text'}
        inputMode={isNumeric ? 'decimal' : undefined}
        step={isNumeric ? 'any' : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {fieldFooter}
    </div>
  )
}

export function LabResultsEntry() {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchItem | null>(null)
  const [activeItemId, setActiveItemId] = useState<string>('')
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({})
  const [queueSearch, setQueueSearch] = useState('')

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['lab-requests'],
    queryFn: async () => {
      const res = await apiRequest<{ items: LabRequestRow[] } | LabRequestRow[]>('/laboratory/requests')
      return Array.isArray(res) ? res : (res.items ?? [])
    },
    refetchInterval: 20_000,
    enabled: !selectedPatient?.id,
  })

  const { data: patientRequests = [], isLoading: patientLoading } = useQuery({
    queryKey: ['lab-patient-requests', selectedPatient?.id],
    queryFn: () =>
      apiRequest<LabRequestRow[]>(`/laboratory/patients/${selectedPatient!.id}/requests`),
    enabled: Boolean(selectedPatient?.id),
  })

  const listSource = selectedPatient ? patientRequests : requests
  const listLoading = selectedPatient ? patientLoading : isLoading
  const activeRequests = listSource.filter((r) => !['verified', 'cancelled'].includes(r.status))

  const filteredRequests = useMemo(() => {
    const q = queueSearch.trim().toLowerCase()
    if (!q) return activeRequests
    return activeRequests.filter((req) => {
      const name = `${req.patient?.firstName ?? ''} ${req.patient?.lastName ?? ''}`.toLowerCase()
      const tests = (req.items ?? []).map(itemLabel).join(' ').toLowerCase()
      return (
        name.includes(q) ||
        (req.patient?.patientNo ?? '').toLowerCase().includes(q) ||
        tests.includes(q)
      )
    })
  }, [activeRequests, queueSearch])

  const {
    data: detail,
    isPending: detailPending,
    isFetching: detailFetching,
  } = useQuery({
    queryKey: ['lab-request', selectedId],
    queryFn: () => apiRequest<LabRequestRow>(`/laboratory/requests/${selectedId!}`),
    enabled: Boolean(selectedId),
  })

  const detailReady = Boolean(detail && detail.id === selectedId)
  const detailLoading = Boolean(selectedId && !detailReady && (detailPending || detailFetching))

  const catalogItems = useMemo(
    () => (detail?.items ?? []).filter((item) => item.orderableTest?.parameters?.length),
    [detail?.items],
  )

  const activeItem = catalogItems.find((item) => item.id === activeItemId) ?? catalogItems[0] ?? null
  const manualItems = useMemo(
    () => (detail?.items ?? []).filter((item) => !item.orderableTest?.parameters?.length),
    [detail?.items],
  )

  useEffect(() => {
    if (!detailReady || !catalogItems.length) return
    const stillValid = catalogItems.some((item) => item.id === activeItemId)
    if (!stillValid) {
      setActiveItemId(catalogItems[0].id)
    }
  }, [detailReady, catalogItems, activeItemId])

  useEffect(() => {
    if (!activeItem) {
      setParameterValues({})
      return
    }
    const vals: Record<string, string> = {}
    for (const result of activeItem.results ?? []) {
      if (result.parameter?.code) vals[result.parameter.code] = result.value
    }
    setParameterValues(vals)
  }, [activeItem?.id])

  const previewInputs = useMemo(() => {
    if (!activeItem?.orderableTest?.parameters?.length) return []
    return activeItem.orderableTest.parameters
      .filter((parameter) => !parameter.calculatedFormula && parameterValues[parameter.code]?.trim())
      .map((parameter) => ({
        parameterCode: parameter.code,
        value: parameterValues[parameter.code].trim(),
      }))
  }, [activeItem, parameterValues])

  const { data: evaluation } = useQuery({
    queryKey: [
      'lab-evaluate',
      activeItem?.id,
      detail?.patient?.dateOfBirth,
      detail?.patient?.gender,
      previewInputs,
    ],
    queryFn: () =>
      apiRequest<EvaluateResponse>('/laboratory/catalog/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          orderableTestCode: activeItem!.orderableTest!.code,
          patient: toCatalogPatient(detail!.patient!),
          results: previewInputs,
        }),
      }),
    enabled: Boolean(activeItem?.orderableTest?.code && detail?.patient && previewInputs.length),
    staleTime: 400,
  })

  const previewFlagByCode = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of evaluation?.flagged ?? []) {
      map.set(row.parameterCode, row.legacyFlag ?? row.flag)
    }
    return map
  }, [evaluation?.flagged])

  const derivedByCode = useMemo(() => {
    const map = new Map<string, string | number>()
    for (const row of evaluation?.derived ?? []) {
      map.set(row.parameterCode, row.value)
    }
    return map
  }, [evaluation?.derived])

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['lab-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['lab-patient-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['lab-request'] }),
      queryClient.invalidateQueries({ queryKey: ['lab-module-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['notification-inbox'] }),
    ])
  }

  const enterResult = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/laboratory/results', {
        method: 'POST',
        body: JSON.stringify({
          requestItemId: form.get('requestItemId'),
          value: form.get('value'),
          unit: form.get('unit') || undefined,
        }),
      })
    },
    onSuccess: async () => {
      notify('Result saved', 'Ordering clinician will be notified on verification.', 'success')
      await refresh()
    },
    onError: (e: Error) => notify('Result entry failed', e.message, 'critical'),
  })

  const enterPanelResults = useMutation({
    mutationFn: () => {
      if (!activeItem?.orderableTest?.parameters?.length) {
        throw new Error('Select a catalog test with parameters.')
      }
      const results = activeItem.orderableTest.parameters
        .filter((parameter) => !parameter.calculatedFormula)
        .map((parameter) => ({
          parameterCode: parameter.code,
          value: parameterValues[parameter.code] ?? '',
        }))
        .filter((entry) => entry.value.trim())

      if (!results.length) {
        throw new Error('Enter at least one parameter value.')
      }

      return apiRequest('/laboratory/results/panel', {
        method: 'POST',
        body: JSON.stringify({
          requestItemId: activeItem.id,
          results,
        }),
      })
    },
    onSuccess: async () => {
      notify('Panel results saved', 'Derived values and flags applied automatically.', 'success')
      await refresh()
      const currentIndex = catalogItems.findIndex((item) => item.id === activeItem?.id)
      if (currentIndex >= 0 && currentIndex < catalogItems.length - 1) {
        setActiveItemId(catalogItems[currentIndex + 1].id)
      }
    },
    onError: (e: Error) => notify('Panel entry failed', e.message, 'critical'),
  })

  const verifyRequest = useMutation({
    mutationFn: (requestId: string) =>
      apiRequest(`/laboratory/requests/${requestId}/verify`, { method: 'POST' }),
    onSuccess: async () => {
      notify('Verified', 'Doctor notified in inbox.', 'success')
      await refresh()
      setSelectedId(null)
    },
    onError: (e: Error) => notify('Verification failed', e.message, 'critical'),
  })

  const attachPdf = async (requestId: string, file: File) => {
    setUploading(true)
    try {
      const uploaded = await uploadClinicalFile(file, 'laboratory', requestId)
      await apiRequest(`/laboratory/requests/${requestId}/attachments`, {
        method: 'POST',
        body: JSON.stringify({
          filename: uploaded.filename,
          mimeType: uploaded.mimeType,
          storagePath: uploaded.storagePath,
          title: uploaded.filename,
        }),
      })
      notify('PDF uploaded', 'Ordering doctor notified.', 'success')
      await refresh()
    } catch (error) {
      notify('Upload failed', (error as Error).message, 'critical')
    } finally {
      setUploading(false)
    }
  }

  const savedResults = activeItem?.results ?? []
  const enteredCount = Object.values(parameterValues).filter((value) => value.trim()).length

  return (
    <div className="space-y-6">
      <LabSection title="Find patient" description="Optional — filter the queue to one patient's open requests.">
        <PatientSearchAutocomplete
          selected={selectedPatient}
          onSelect={(patient) => {
            setSelectedPatient(patient)
            setSelectedId(null)
            setActiveItemId('')
            setParameterValues({})
          }}
        />
        {selectedPatient ? (
          <p className="mt-3 text-sm text-teal-800">
            Filtering for{' '}
            <strong>
              {selectedPatient.firstName} {selectedPatient.lastName}
            </strong>{' '}
            ({selectedPatient.patientNo}) ·{' '}
            <button type="button" className="font-semibold underline" onClick={() => setSelectedPatient(null)}>
              Show all
            </button>
          </p>
        ) : null}
      </LabSection>

      <LabSection title="Open requests" description={`${filteredRequests.length} awaiting results — click a card to enter values`}>
        <label className="relative mb-4 block max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input w-full pl-10"
            placeholder="Search queue…"
            value={queueSearch}
            onChange={(e) => setQueueSearch(e.target.value)}
          />
        </label>
        {listLoading ? (
          <div className="h-48 animate-skeleton rounded-2xl" />
        ) : filteredRequests.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredRequests.map((req) => (
              <LabQueueItem
                key={req.id}
                active={selectedId === req.id}
                onClick={() => {
                  setSelectedId(req.id)
                  setActiveItemId('')
                  setParameterValues({})
                }}
                name={
                  req.patient ? `${req.patient.firstName} ${req.patient.lastName}` : 'Unknown patient'
                }
                patientNo={req.patient?.patientNo}
                status={req.status}
                priority={req.priority}
                wait={waitLabel(req.createdAt)}
                subtitle={requestTestSummary(req.items)}
              />
            ))}
          </div>
        ) : (
          <LabEmptyState title="No open requests" description="The result entry queue is empty." />
        )}
      </LabSection>

      {selectedId ? (
        <LabModal
          wide
          title="Result entry"
          description="Enter structured panel results or attach a PDF report."
          onClose={() => {
            setSelectedId(null)
            setActiveItemId('')
            setParameterValues({})
          }}
        >
          <div className="space-y-6">
          {detailLoading ? (
            <div className="space-y-4">
              <div className="h-20 animate-skeleton rounded-2xl" />
              <div className="h-72 animate-skeleton rounded-2xl" />
              <div className="h-40 animate-skeleton rounded-2xl" />
            </div>
          ) : detailReady && detail ? (
            <>
              <LabPatientStrip
                firstName={detail.patient?.firstName}
                lastName={detail.patient?.lastName}
                patientNo={detail.patient?.patientNo}
                status={detail.status}
                priority={detail.priority}
                wait={waitLabel(detail.createdAt)}
              />

              {catalogItems.length ? (
                <LabSection
                  title="Structured panel entry"
                  description="Enter all ordered tests in sequence — flags and derived values apply automatically."
                >
                  {catalogItems.length > 1 ? (
                    <div className="mb-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Test entry sequence · {catalogItems.length} ordered
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {catalogItems.map((item, index) => {
                          const isActive = item.id === activeItem?.id
                          const isDone = (item.results?.length ?? 0) > 0
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setActiveItemId(item.id)}
                              className={clsx(
                                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                                isActive
                                  ? 'border-teal-600 bg-teal-600 text-white shadow-sm'
                                  : isDone
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-teal-200',
                              )}
                            >
                              <span>{index + 1}</span>
                              {itemLabel(item)}
                              {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="mb-4 text-sm font-semibold text-teal-900">{itemLabel(activeItem!)}</p>
                  )}

                  {savedResults.length ? (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Saved on record · {savedResults.length} parameter{savedResults.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {savedResults.map((result) => (
                          <div
                            key={result.id}
                            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                          >
                            <span className="font-medium text-slate-800">
                              {result.parameter?.name ?? result.parameter?.code ?? 'Result'}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="font-semibold tabular-nums text-slate-900">
                                {result.value}
                                {result.unit ? ` ${result.unit}` : ''}
                              </span>
                              {result.referenceRange ? (
                                <span className="text-xs text-slate-500">({result.referenceRange})</span>
                              ) : null}
                              <LabFlagBadge flag={result.flag} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="lab-param-grid mt-4">
                    {activeItem?.orderableTest?.parameters
                      ?.slice()
                      .sort((a, b) => a.orderIndex - b.orderIndex)
                      .map((parameter) => (
                        <ParameterField
                          key={parameter.id}
                          parameter={parameter}
                          value={parameterValues[parameter.code] ?? ''}
                          refHint={formatRefHint(parameter.referenceRanges)}
                          previewFlag={previewFlagByCode.get(parameter.code) ?? null}
                          derivedPreview={derivedByCode.get(parameter.code) ?? null}
                          onChange={(value) =>
                            setParameterValues((current) => ({ ...current, [parameter.code]: value }))
                          }
                        />
                      ))}
                  </div>

                  <p className="mt-4 text-xs text-slate-500">
                    {enteredCount} value{enteredCount === 1 ? '' : 's'} entered
                    {previewInputs.length ? ' · live flag preview active' : ''}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
                    <Button type="button" loading={enterPanelResults.isPending} onClick={() => enterPanelResults.mutate()}>
                      <CheckCircle2 className="h-4 w-4" />
                      {savedResults.length
                        ? catalogItems.findIndex((i) => i.id === activeItem?.id) < catalogItems.length - 1
                          ? 'Update & next test'
                          : 'Update panel results'
                        : catalogItems.findIndex((i) => i.id === activeItem?.id) < catalogItems.length - 1
                          ? 'Save & next test'
                          : 'Save panel results'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => verifyRequest.mutate(detail.id)}
                      loading={verifyRequest.isPending}
                    >
                      Verify & release
                    </Button>
                  </div>
                </LabSection>
              ) : manualItems.length ? (
                <LabEmptyState
                  title="No catalog parameters"
                  description="This request uses legacy tests only. Enter single values below or attach a PDF report."
                />
              ) : null}

              <LabSection title="PDF / instrument report" description="Upload external analyzer output when structured entry is not used.">
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <FileUp className="h-4 w-4 text-teal-600" />
                    Attach report file
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/pdf,image/*"
                    className="mt-3 w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-teal-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (file) await attachPdf(detail.id, file)
                      e.target.value = ''
                    }}
                  />
                  {uploading ? <p className="mt-2 text-xs text-teal-700">Uploading…</p> : null}
                </div>

                {(detail.attachments ?? []).length ? (
                  <div className="mt-4 space-y-2">
                    {detail.attachments!.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <span className="text-sm font-medium">{file.title ?? file.filename}</span>
                        <Button type="button" variant="secondary" onClick={() => viewClinicalFile(file.storagePath)}>
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </LabSection>

              {manualItems.length ? (
                <LabSection title="Single-value entry" description="For legacy or non-catalog tests.">
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault()
                      enterResult.mutate(e.currentTarget)
                    }}
                  >
                    <SelectField name="requestItemId" label="Test" required>
                      {manualItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {itemLabel(item)}
                        </option>
                      ))}
                    </SelectField>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field name="value" label="Value" required />
                      <Field name="unit" label="Unit" />
                    </div>
                    <Button type="submit" loading={enterResult.isPending}>
                      Save result
                    </Button>
                  </form>
                </LabSection>
              ) : null}

              {!catalogItems.length ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => verifyRequest.mutate(detail.id)}
                    loading={verifyRequest.isPending}
                  >
                    Verify & notify doctor
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <LabEmptyState title="Could not load request" description="Try selecting the request again." />
          )}
          </div>
        </LabModal>
      ) : null}
    </div>
  )
}
