import { useMemo, useState } from 'react'
import { formDataFromElement } from '../../lib/form-utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FlaskConical, ScanLine, Search } from 'lucide-react'
import clsx from 'clsx'
import {
  Alert,
  Button,
  Field,
  SelectField,
  TextareaField,
} from '../ui'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'

export type InvestigationOrderContext = {
  patientId: string
  patientName: string
  encounterId?: string | null
  admissionId?: string | null
  encounterNo?: string | null
  admissionNo?: string | null
  wardName?: string | null
  defaultClinicalIndication?: string
}

type LabTest = { id: string; name: string; code?: string }
type LabPanel = { id: string; name: string; code?: string }
type RadiologyModality = { id: string; name: string }

export function ClinicalInvestigationOrders({
  context,
  onSuccess,
  compact = false,
  defaultMode = 'lab',
}: {
  context: InvestigationOrderContext
  onSuccess?: () => void
  compact?: boolean
  defaultMode?: 'lab' | 'radiology'
}) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'lab' | 'radiology'>(defaultMode)
  const [labKind, setLabKind] = useState<'panel' | 'tests'>('tests')
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([])
  const [panelId, setPanelId] = useState('')
  const [testQuery, setTestQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const { data: tests = [] } = useQuery({
    queryKey: ['clinical-order-tests'],
    queryFn: () => apiRequest<LabTest[]>('/laboratory/tests'),
  })

  const { data: panels = [] } = useQuery({
    queryKey: ['clinical-order-panels'],
    queryFn: () => apiRequest<LabPanel[]>('/laboratory/panels'),
  })

  const { data: modalities = [] } = useQuery({
    queryKey: ['clinical-order-modalities'],
    queryFn: () => apiRequest<RadiologyModality[]>('/radiology/modalities'),
  })

  const filteredTests = useMemo(() => {
    const q = testQuery.trim().toLowerCase()
    if (!q) return tests
    return tests.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.code ?? '').toLowerCase().includes(q),
    )
  }, [tests, testQuery])

  const contextLabel = context.admissionNo
    ? `Inpatient · ${context.admissionNo}${context.wardName ? ` · ${context.wardName}` : ''}`
    : context.encounterNo
      ? `Encounter · ${context.encounterNo}`
      : 'Active visit will be linked automatically'

  const orderLab = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      const testIds = labKind === 'tests' ? selectedTestIds : []
      const panelIds = labKind === 'panel' && panelId ? [panelId] : []
      if (!testIds.length && !panelIds.length) {
        throw new Error(
          labKind === 'panel'
            ? 'Select a laboratory panel.'
            : 'Select at least one laboratory test.',
        )
      }
      return apiRequest('/laboratory/requests', {
        method: 'POST',
        body: JSON.stringify({
          patientId: context.patientId,
          encounterId: context.encounterId || undefined,
          admissionId: context.admissionId || undefined,
          priority: form.get('priority'),
          notes: form.get('notes') || undefined,
          testIds,
          panelIds,
        }),
      })
    },
    onSuccess: async () => {
      setMessage('Laboratory request sent to the worklist.')
      notify('Lab order placed', `${context.patientName} — sent to laboratory.`, 'success')
      setSelectedTestIds([])
      setPanelId('')
      setTestQuery('')
      await queryClient.invalidateQueries({ queryKey: ['lab-requests'] })
      await queryClient.invalidateQueries({ queryKey: ['clinical-orders'] })
      onSuccess?.()
    },
    onError: (error: Error) => {
      setMessage(error.message)
      notify('Lab order failed', error.message, 'critical')
    },
  })

  const orderRadiology = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      const modalityId = form.get('modalityId')?.toString()?.trim()
      if (!modalityId) {
        throw new Error('Select an imaging modality.')
      }
      return apiRequest('/radiology/requests', {
        method: 'POST',
        body: JSON.stringify({
          patientId: context.patientId,
          encounterId: context.encounterId || undefined,
          admissionId: context.admissionId || undefined,
          modalityId,
          bodyPart: form.get('bodyPart'),
          views: form.get('views') || undefined,
          clinicalIndication: form.get('clinicalIndication'),
          priority: form.get('priority'),
        }),
      })
    },
    onSuccess: async () => {
      setMessage('Radiology request sent to the imaging worklist.')
      notify('Radiology order placed', `${context.patientName} — sent to radiology.`, 'success')
      await queryClient.invalidateQueries({ queryKey: ['radiology-requests'] })
      await queryClient.invalidateQueries({ queryKey: ['clinical-orders'] })
      onSuccess?.()
    },
    onError: (error: Error) => {
      setMessage(error.message)
      notify('Radiology order failed', error.message, 'critical')
    },
  })

  function toggleTest(id: string) {
    setSelectedTestIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )
  }

  const shell = compact
    ? 'space-y-4'
    : 'card-hover rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm space-y-4'

  return (
    <div className={shell}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
            Lab & imaging orders
          </p>
          <p className="mt-1 text-base font-semibold text-slate-900">{context.patientName}</p>
          <p className="text-sm text-slate-500">{contextLabel}</p>
          <p className="mt-1 text-xs text-slate-400">
            Medications are ordered under the Medications tab — not here.
          </p>
        </div>
        <div className="flex rounded-xl border border-slate-200 p-1">
          {(
            [
              ['lab', 'Laboratory', FlaskConical],
              ['radiology', 'Radiology', ScanLine],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setMode(key)
                setMessage(null)
              }}
              className={clsx(
                'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold',
                mode === key ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'lab' ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            orderLab.mutate(e.currentTarget)
          }}
        >
          <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
            <button
              type="button"
              className={clsx(
                'min-h-11 flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold',
                labKind === 'tests' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600',
              )}
              onClick={() => {
                setLabKind('tests')
                setPanelId('')
                setMessage(null)
              }}
            >
              Individual tests
            </button>
            <button
              type="button"
              className={clsx(
                'min-h-11 flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold',
                labKind === 'panel' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600',
              )}
              onClick={() => {
                setLabKind('panel')
                setSelectedTestIds([])
                setMessage(null)
              }}
            >
              Lab panel
            </button>
          </div>

          {labKind === 'panel' ? (
            <SelectField
              name="panelId"
              label="Laboratory panel"
              hint="Orders every test in the panel"
              required
              value={panelId}
              onChange={(e) => setPanelId(e.target.value)}
            >
              <option value="">Select a panel…</option>
              {panels.map((panel) => (
                <option key={panel.id} value={panel.id}>
                  {panel.code ? `${panel.code} — ` : ''}
                  {panel.name}
                </option>
              ))}
            </SelectField>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Laboratory tests
                  <span className="ml-0.5 text-red-500">*</span>
                </span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="input pl-10"
                    placeholder="Search tests by name or code…"
                    value={testQuery}
                    onChange={(e) => setTestQuery(e.target.value)}
                  />
                </div>
              </label>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                {filteredTests.map((test) => {
                  const checked = selectedTestIds.includes(test.id)
                  return (
                    <label
                      key={test.id}
                      className={clsx(
                        'flex min-h-12 cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0',
                        checked ? 'bg-teal-50' : 'hover:bg-slate-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-teal-600"
                        checked={checked}
                        onChange={() => toggleTest(test.id)}
                      />
                      <span className="font-medium text-slate-800">{test.name}</span>
                      {test.code ? (
                        <span className="ml-auto text-xs text-slate-400">{test.code}</span>
                      ) : null}
                    </label>
                  )
                })}
                {!filteredTests.length ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-500">
                    {tests.length ? 'No tests match your search.' : 'No lab tests configured yet.'}
                  </p>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">
                {selectedTestIds.length
                  ? `${selectedTestIds.length} test${selectedTestIds.length === 1 ? '' : 's'} selected`
                  : 'Tick one or more tests to order.'}
              </p>
            </div>
          )}

          <SelectField name="priority" label="Priority" required defaultValue="routine">
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="stat">STAT</option>
          </SelectField>
          <TextareaField
            name="notes"
            label="Clinical notes"
            placeholder="Indication, fasting status, relevant history"
            defaultValue={context.defaultClinicalIndication}
          />
          <Button type="submit" loading={orderLab.isPending} className="w-full min-h-12">
            Send lab order
          </Button>
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            orderRadiology.mutate(e.currentTarget)
          }}
        >
          <SelectField name="modalityId" label="Imaging modality" required>
            <option value="">Select modality…</option>
            {modalities.map((modality) => (
              <option key={modality.id} value={modality.id}>
                {modality.name}
              </option>
            ))}
          </SelectField>
          <Field name="bodyPart" label="Body part / region" required placeholder="e.g. Chest, Abdomen" />
          <Field name="views" label="Views" placeholder="e.g. PA and lateral" />
          <TextareaField
            name="clinicalIndication"
            label="Clinical indication"
            required
            defaultValue={context.defaultClinicalIndication}
            placeholder="Reason for imaging and relevant findings"
          />
          <SelectField name="priority" label="Priority" required defaultValue="routine">
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="stat">STAT</option>
          </SelectField>
          <Button type="submit" loading={orderRadiology.isPending} className="w-full min-h-12">
            Send radiology order
          </Button>
        </form>
      )}

      {message ? (
        <Alert tone={orderLab.isError || orderRadiology.isError ? 'error' : 'success'}>
          {message}
        </Alert>
      ) : null}

      {!compact ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-600">
            Orders are linked to this visit automatically. The ordering clinician and attending
            doctor receive inbox notifications when results are verified.
          </p>
        </div>
      ) : null}
    </div>
  )
}
