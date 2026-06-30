import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, ClinicalForm, Field, FormActions, FormSection, PageHeader, SelectField } from '../../ui'
import { formDataFromElement, submitClinicalForm } from '../../../lib/form-utils'
import { apiRequest } from '../../../lib/api'
import { notify } from '../../../lib/notify'

type LabPanel = { id: string; name: string; code: string; category: string; description?: string | null }
type LabTest = {
  id: string
  name: string
  code: string
  sampleType: string
  referenceRange?: string | null
  unit?: string | null
  turnaroundHours?: number | null
  panel?: { name: string } | null
}

const categories = [
  'haematology',
  'biochemistry',
  'microbiology',
  'immunology',
  'urinalysis',
  'coagulation',
] as const

const sampleTypes = [
  'whole_blood',
  'serum',
  'plasma',
  'urine',
  'swab',
  'stool',
  'csf',
  'tissue',
] as const

export function LabCatalogPanel() {
  const queryClient = useQueryClient()
  const { data: panels = [], isLoading: panelsLoading } = useQuery({
    queryKey: ['lab-panels'],
    queryFn: () => apiRequest<LabPanel[]>('/laboratory/panels'),
  })
  const { data: tests = [], isLoading: testsLoading } = useQuery({
    queryKey: ['lab-tests'],
    queryFn: () => apiRequest<LabTest[]>('/laboratory/tests'),
  })

  const createPanel = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/laboratory/panels', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          code: form.get('code'),
          description: form.get('description') || undefined,
          category: form.get('category'),
        }),
      })
    },
    onSuccess: async () => {
      notify('Panel added', 'Laboratory panel saved.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['lab-panels'] })
    },
  })

  const createTest = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/laboratory/tests', {
        method: 'POST',
        body: JSON.stringify({
          panelId: form.get('panelId') || undefined,
          name: form.get('name'),
          code: form.get('code'),
          sampleType: form.get('sampleType'),
          referenceRange: form.get('referenceRange') || undefined,
          unit: form.get('unit') || undefined,
          turnaroundHours: form.get('turnaroundHours') ? Number(form.get('turnaroundHours')) : undefined,
          criticalLow: form.get('criticalLow') ? Number(form.get('criticalLow')) : undefined,
          criticalHigh: form.get('criticalHigh') ? Number(form.get('criticalHigh')) : undefined,
        }),
      })
    },
    onSuccess: async () => {
      notify('Test added', 'Laboratory test saved.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['lab-tests'] })
    },
  })

  return (
    <div className="space-y-6">
      <Card className="p-8">
        <PageHeader
          title="Laboratory catalog"
          description="Panels, tests, reference ranges, and turnaround times used across ordering and worklists."
        />
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Panels ({panels.length})</h3>
            {panelsLoading ? (
              <div className="mt-3 h-24 animate-skeleton rounded-xl" />
            ) : (
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {panels.map((panel) => (
                  <li key={panel.id} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
                    <p className="font-semibold">{panel.name}</p>
                    <p className="text-xs text-slate-500">
                      {panel.code} · {panel.category}
                    </p>
                  </li>
                ))}
                {!panels.length ? <p className="text-sm text-slate-500">No panels configured.</p> : null}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Tests ({tests.length})</h3>
            {testsLoading ? (
              <div className="mt-3 h-24 animate-skeleton rounded-xl" />
            ) : (
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {tests.map((test) => (
                  <li key={test.id} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
                    <p className="font-semibold">{test.name}</p>
                    <p className="text-xs text-slate-500">
                      {test.code}
                      {test.panel?.name ? ` · ${test.panel.name}` : ''}
                      {test.referenceRange ? ` · Ref ${test.referenceRange}` : ''}
                      {test.turnaroundHours ? ` · ${test.turnaroundHours}h TAT` : ''}
                    </p>
                  </li>
                ))}
                {!tests.length ? <p className="text-sm text-slate-500">No tests configured.</p> : null}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <PageHeader title="Add panel" description="Group related tests (e.g. Full Blood Count)." />
          <ClinicalForm className="mt-6" onSubmit={(e) => submitClinicalForm(createPanel, e)}>
            <FormSection title="Panel details" columns={1}>
              <Field name="name" label="Panel name" required />
              <Field name="code" label="Code" required placeholder="FBC" />
              <SelectField name="category" label="Category" required defaultValue="haematology">
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectField>
              <Field name="description" label="Description" />
            </FormSection>
            {createPanel.error ? <Alert tone="error">{createPanel.error.message}</Alert> : null}
            <FormActions>
              <Button type="submit" loading={createPanel.isPending}>Save panel</Button>
            </FormActions>
          </ClinicalForm>
        </Card>

        <Card className="p-6">
          <PageHeader title="Add test" description="Individual analytes with reference ranges." />
          <ClinicalForm className="mt-6" onSubmit={(e) => submitClinicalForm(createTest, e)}>
            <FormSection title="Test details" columns={1}>
              <SelectField name="panelId" label="Panel (optional)">
                <option value="">Standalone test</option>
                {panels.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </SelectField>
              <Field name="name" label="Test name" required />
              <Field name="code" label="Code" required />
              <SelectField name="sampleType" label="Sample type" required defaultValue="whole_blood">
                {sampleTypes.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </SelectField>
              <Field name="referenceRange" label="Reference range" placeholder="e.g. 4.0-10.0" />
              <Field name="unit" label="Unit" placeholder="g/dL" />
              <Field name="turnaroundHours" label="Turnaround (hours)" type="number" />
              <Field name="criticalLow" label="Critical low" type="number" step="any" />
              <Field name="criticalHigh" label="Critical high" type="number" step="any" />
            </FormSection>
            {createTest.error ? <Alert tone="error">{createTest.error.message}</Alert> : null}
            <FormActions>
              <Button type="submit" loading={createTest.isPending}>Save test</Button>
            </FormActions>
          </ClinicalForm>
        </Card>
      </div>
    </div>
  )
}
