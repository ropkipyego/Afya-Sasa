import { useState } from 'react'
import { formDataFromElement } from '../../lib/form-utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FlaskConical, ScanLine } from 'lucide-react'
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

  const contextLabel = context.admissionNo
    ? `Inpatient · ${context.admissionNo}${context.wardName ? ` · ${context.wardName}` : ''}`
      : context.encounterNo
        ? `Encounter · ${context.encounterNo}`
        : 'Active visit will be linked automatically'

  const orderLab = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      const testId = form.get('testId')?.toString()
      const panelId = form.get('panelId')?.toString()
      if (!testId && !panelId) {
        throw new Error('Select a laboratory test or panel.')
      }
      return apiRequest('/laboratory/requests', {
        method: 'POST',
        body: JSON.stringify({
          patientId: context.patientId,
          encounterId: context.encounterId || undefined,
          admissionId: context.admissionId || undefined,
          priority: form.get('priority'),
          notes: form.get('notes') || undefined,
          testIds: testId ? [testId] : [],
          panelIds: panelId ? [panelId] : [],
        }),
      })
    },
    onSuccess: async () => {
      setMessage('Laboratory request sent to the worklist.')
      notify('Lab order placed', `${context.patientName} — sent to laboratory.`, 'success')
      await queryClient.invalidateQueries({ queryKey: ['lab-requests'] })
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
      return apiRequest('/radiology/requests', {
        method: 'POST',
        body: JSON.stringify({
          patientId: context.patientId,
          encounterId: context.encounterId || undefined,
          admissionId: context.admissionId || undefined,
          modalityId: form.get('modalityId'),
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
      onSuccess?.()
    },
    onError: (error: Error) => setMessage(error.message),
  })

  const shell = compact ? 'space-y-4' : 'card-hover rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4'

  return (
    <div className={shell}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
            Investigation orders
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{context.patientName}</p>
          <p className="text-xs text-slate-500">{contextLabel}</p>
        </div>
        <div className="flex rounded-lg border border-slate-200 p-1">
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
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold',
                mode === key ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>


      {mode === 'lab' ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            orderLab.mutate(e.currentTarget)
            e.currentTarget.reset()
          }}
        >
          <SelectField name="panelId" label="Laboratory panel" hint="Optional if ordering a single test">
            <option value="">No panel</option>
            {panels.map((panel) => (
              <option key={panel.id} value={panel.id}>
                {panel.name}
              </option>
            ))}
          </SelectField>
          <SelectField name="testId" label="Laboratory test" hint="Optional if a panel is selected">
            <option value="">No single test</option>
            {tests.map((test) => (
              <option key={test.id} value={test.id}>
                {test.name}
              </option>
            ))}
          </SelectField>
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
          <Button type="submit" loading={orderLab.isPending} className="w-full">
            Send lab order
          </Button>
        </form>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            orderRadiology.mutate(e.currentTarget)
            e.currentTarget.reset()
          }}
        >
          <SelectField name="modalityId" label="Imaging modality" required>
            <option value="">Select modality</option>
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
          <Button type="submit" loading={orderRadiology.isPending} className="w-full">
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
