import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, ClinicalForm, Field, FormActions, FormSection, PageHeader } from '../../ui'
import { formDataFromElement, submitClinicalForm } from '../../../lib/form-utils'
import { apiRequest } from '../../../lib/api'
import { notify } from '../../../lib/notify'

type Modality = { id: string; name: string; code: string; description?: string | null }

export function RadiologyCatalogPanel() {
  const queryClient = useQueryClient()
  const { data: modalities = [], isLoading } = useQuery({
    queryKey: ['radiology-modalities'],
    queryFn: () => apiRequest<Modality[]>('/radiology/modalities'),
  })

  const createModality = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/radiology/modalities', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          code: form.get('code'),
          description: form.get('description') || undefined,
        }),
      })
    },
    onSuccess: async () => {
      notify('Modality added', 'Radiology catalog updated.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['radiology-modalities'] })
    },
  })

  return (
    <div className="space-y-6">
      <Card className="p-8">
        <PageHeader
          title="Radiology catalog"
          description="Imaging modalities available for ordering and worklist routing."
        />
        {isLoading ? (
          <div className="mt-6 h-32 animate-skeleton rounded-xl" />
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {modalities.map((modality) => (
              <li key={modality.id} className="rounded-xl border border-slate-200 px-4 py-3">
                <p className="font-semibold">{modality.name}</p>
                <p className="text-xs text-slate-500">{modality.code}</p>
                {modality.description ? <p className="mt-1 text-sm text-slate-600">{modality.description}</p> : null}
              </li>
            ))}
            {!modalities.length ? <p className="text-sm text-slate-500">No modalities configured.</p> : null}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <PageHeader title="Add modality" description="X-Ray, ultrasound, CT, MRI, etc." />
        <ClinicalForm className="mt-6" onSubmit={(e) => submitClinicalForm(createModality, e)}>
          <FormSection title="Modality details" columns={1}>
            <Field name="name" label="Modality name" required placeholder="X-Ray" />
            <Field name="code" label="Code" required placeholder="XR" />
            <Field name="description" label="Description" />
          </FormSection>
          {createModality.error ? <Alert tone="error">{createModality.error.message}</Alert> : null}
          <FormActions>
            <Button type="submit" loading={createModality.isPending}>Save modality</Button>
          </FormActions>
        </ClinicalForm>
      </Card>
    </div>
  )
}
