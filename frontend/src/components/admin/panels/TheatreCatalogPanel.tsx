import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, ClinicalForm, Field, FormActions, PageHeader } from '../../ui'
import { formDataFromElement } from '../../../lib/form-utils'
import { apiRequest } from '../../../lib/api'
import { notify } from '../../../lib/notify'

type Theatre = { id: string; name: string; code: string; location?: string | null; status: string }
type Procedure = {
  id: string
  name: string
  code: string
  category?: string | null
  expectedDurationMinutes?: number | null
}

export function TheatreCatalogPanel() {
  const queryClient = useQueryClient()
  const { data: theatres = [] } = useQuery({
    queryKey: ['theatres'],
    queryFn: () => apiRequest<Theatre[]>('/theatre/theatres'),
  })
  const { data: procedures = [] } = useQuery({
    queryKey: ['surgical-procedures'],
    queryFn: () => apiRequest<Procedure[]>('/theatre/procedures'),
  })

  const createTheatre = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/theatre/theatres', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          code: form.get('code'),
          location: form.get('location') || undefined,
        }),
      })
    },
    onSuccess: async () => {
      notify('Theatre added', 'Operating room saved.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['theatres'] })
    },
  })

  const createProcedure = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/theatre/procedures', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          code: form.get('code'),
          category: form.get('category') || undefined,
          expectedDurationMinutes: form.get('expectedDurationMinutes')
            ? Number(form.get('expectedDurationMinutes'))
            : undefined,
        }),
      })
    },
    onSuccess: async () => {
      notify('Procedure added', 'Surgical procedure saved.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['surgical-procedures'] })
    },
  })

  return (
    <div className="space-y-6">
      <Card className="p-8">
        <PageHeader title="Theatre configuration" description="Operating rooms and surgical procedure types." />
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold uppercase text-slate-500">Operating rooms</h3>
            <ul className="mt-3 space-y-2">
              {theatres.map((t) => (
                <li key={t.id} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-xs text-slate-500">
                    {t.code} · {t.status}
                    {t.location ? ` · ${t.location}` : ''}
                  </p>
                </li>
              ))}
              {!theatres.length ? <p className="text-sm text-slate-500">No theatres configured.</p> : null}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase text-slate-500">Procedures</h3>
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {procedures.map((p) => (
                <li key={p.id} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    {p.code}
                    {p.category ? ` · ${p.category}` : ''}
                    {p.expectedDurationMinutes ? ` · ${p.expectedDurationMinutes} min` : ''}
                  </p>
                </li>
              ))}
              {!procedures.length ? <p className="text-sm text-slate-500">No procedures configured.</p> : null}
            </ul>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <PageHeader title="Add operating room" />
          <ClinicalForm className="mt-6" onSubmit={(e) => { e.preventDefault(); createTheatre.mutate(e.currentTarget) }}>
            <Field name="name" label="Theatre name" required />
            <Field name="code" label="Code" required />
            <Field name="location" label="Location" />
            {createTheatre.error ? <Alert tone="error">{createTheatre.error.message}</Alert> : null}
            <FormActions>
              <Button type="submit" loading={createTheatre.isPending}>Save theatre</Button>
            </FormActions>
          </ClinicalForm>
        </Card>
        <Card className="p-6">
          <PageHeader title="Add procedure" />
          <ClinicalForm className="mt-6" onSubmit={(e) => { e.preventDefault(); createProcedure.mutate(e.currentTarget) }}>
            <Field name="name" label="Procedure name" required />
            <Field name="code" label="Code" required />
            <Field name="category" label="Category" placeholder="General surgery" />
            <Field name="expectedDurationMinutes" label="Expected duration (minutes)" type="number" />
            {createProcedure.error ? <Alert tone="error">{createProcedure.error.message}</Alert> : null}
            <FormActions>
              <Button type="submit" loading={createProcedure.isPending}>Save procedure</Button>
            </FormActions>
          </ClinicalForm>
        </Card>
      </div>
    </div>
  )
}
