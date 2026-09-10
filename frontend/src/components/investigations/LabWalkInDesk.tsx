import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import clsx from 'clsx'
import {
  Alert,
  Button,
  Card,
  FormActions,
  PageHeader,
  SelectField,
  TextareaField,
  WorkflowSteps,
} from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { PatientContextHeader } from '../PatientContextHeader'
import { PaymentCheckoutPanel } from '../payments/PaymentCheckoutPanel'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'

type CatalogTest = {
  id: string
  name: string
  code: string
  isPanel: boolean
}

type LabRequestResponse = {
  id: string
  requestNo?: string
}

const steps = ['Patient', 'Tests & notes', 'Payment', 'Done']

export function LabWalkInDesk() {
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [patient, setPatient] = useState<PatientSearchItem | null>(null)
  const [walkInSource, setWalkInSource] = useState<'self_request' | 'walk_in' | 'referral'>('walk_in')
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([])
  const [testQuery, setTestQuery] = useState('')
  const [priority, setPriority] = useState('routine')
  const [notes, setNotes] = useState('')
  const [lastRequest, setLastRequest] = useState<LabRequestResponse | null>(null)
  const [orderSummary, setOrderSummary] = useState('')

  const { data: catalogTests = [] } = useQuery({
    queryKey: ['clinical-order-catalog-tests'],
    queryFn: () => apiRequest<CatalogTest[]>('/laboratory/catalog/tests'),
  })

  const tests = useMemo(() => catalogTests.filter((t) => !t.isPanel), [catalogTests])
  const panels = useMemo(() => catalogTests.filter((t) => t.isPanel), [catalogTests])

  const filteredTests = useMemo(() => {
    const q = testQuery.trim().toLowerCase()
    if (!q) return [...panels, ...tests]
    return [...panels, ...tests].filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.code ?? '').toLowerCase().includes(q),
    )
  }, [panels, tests, testQuery])

  const resetForm = () => {
    setStep(0)
    setPatient(null)
    setWalkInSource('walk_in')
    setSelectedTestIds([])
    setTestQuery('')
    setPriority('routine')
    setNotes('')
    setLastRequest(null)
    setOrderSummary('')
  }

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!patient) throw new Error('Select a patient first.')
      if (!selectedTestIds.length) throw new Error('Select at least one test or panel.')
      return apiRequest<LabRequestResponse>('/laboratory/requests', {
        method: 'POST',
        body: JSON.stringify({
          patientId: patient.id,
          priority,
          notes: notes || undefined,
          orderableTestIds: selectedTestIds,
          walkInSource,
        }),
      })
    },
    onSuccess: async (request) => {
      const names = selectedTestIds
        .map((id) => catalogTests.find((t) => t.id === id)?.name)
        .filter(Boolean)
        .join(', ')
      setLastRequest(request)
      setOrderSummary(names || 'Laboratory tests')
      notify(
        'Lab order placed',
        request.requestNo ? `#${request.requestNo} sent to worklist.` : 'Sent to worklist.',
        'success',
      )
      await queryClient.invalidateQueries({ queryKey: ['lab-requests'] })
      setStep(2)
    },
    onError: (error: Error) => notify('Order failed', error.message, 'critical'),
  })

  function toggleTest(id: string) {
    setSelectedTestIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )
  }

  return (
    <div className="workspace-shell animate-fade-in">
      <Card className="card-hover p-5 md:p-8">
        <PageHeader
          eyebrow="Laboratory · Front desk"
          title="Walk-in & self-request lab desk"
          description="Fill the lab request online — select tests, add clinical notes, then collect payment through the shared hospital payment module."
        />
        <WorkflowSteps steps={steps} current={step} />

        {step === 0 ? (
          <div className="mt-8 space-y-6">
            <PatientSearchAutocomplete selected={patient} onSelect={setPatient} />
            {patient ? <PatientContextHeader patient={patient} workflowStep="checked_in" /> : null}
            <SelectField
              name="walkInSource"
              label="Request source"
              value={walkInSource}
              onChange={(e) =>
                setWalkInSource(e.target.value as 'self_request' | 'walk_in' | 'referral')
              }
            >
              <option value="walk_in">Walk-in patient</option>
              <option value="self_request">Self-request</option>
              <option value="referral">Referral with lab order</option>
            </SelectField>
            <FormActions>
              <Button type="button" disabled={!patient} onClick={() => setStep(1)}>
                Continue →
              </Button>
            </FormActions>
          </div>
        ) : null}

        {step === 1 && patient ? (
          <div className="mt-8 space-y-6">
            <PatientContextHeader patient={patient} workflowStep="checked_in" />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Tests & panels <span className="text-red-500">*</span>
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-10"
                  placeholder="Search catalog…"
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
                    <span className="font-medium text-slate-800">
                      {test.isPanel ? `${test.name} (panel)` : test.name}
                    </span>
                    {test.code ? (
                      <span className="ml-auto text-xs text-slate-400">{test.code}</span>
                    ) : null}
                  </label>
                )
              })}
            </div>
            <SelectField
              name="priority"
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="stat">STAT</option>
            </SelectField>
            <TextareaField
              name="notes"
              label="Clinical notes / indication"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Fasting status, referring clinician, special handling"
            />
            <FormActions>
              <Button type="button" variant="secondary" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button
                type="button"
                disabled={!selectedTestIds.length}
                loading={createOrder.isPending}
                onClick={() => createOrder.mutate()}
              >
                Place order → payment
              </Button>
            </FormActions>
          </div>
        ) : null}

        {step === 2 && patient && lastRequest ? (
          <div className="mt-8 space-y-6">
            <Alert tone="success">
              Lab request {lastRequest.requestNo ? `#${lastRequest.requestNo}` : ''} created. Collect
              payment below — same M-Pesa STK flow used across OPD, pharmacy, and radiology.
            </Alert>
            <PaymentCheckoutPanel
              patientId={patient.id}
              patientPhone={patient.primaryPhone}
              serviceLine="laboratory"
              serviceEntityId={lastRequest.id}
              serviceDescription={orderSummary}
              submitLabel="Send M-Pesa STK / record payment"
              receiptPatient={{
                name: `${patient.firstName} ${patient.lastName}`,
                patientNo: patient.patientNo,
              }}
              onSuccess={() => setStep(3)}
            />
            <Button type="button" variant="ghost" onClick={() => setStep(3)}>
              Skip payment for now
            </Button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-8 space-y-6">
            <Alert tone="success">Walk-in lab workflow complete.</Alert>
            <FormActions>
              <Button type="button" onClick={resetForm}>
                Register another walk-in
              </Button>
            </FormActions>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
