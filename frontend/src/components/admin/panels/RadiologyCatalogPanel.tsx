import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { Alert, Button, Card, ClinicalForm, Field, FormActions, FormSection, PageHeader } from '../../ui'
import { formDataFromElement, submitClinicalForm } from '../../../lib/form-utils'
import { apiRequest } from '../../../lib/api'
import { notify } from '../../../lib/notify'

type Modality = { id: string; name: string; code: string }
type Study = {
  code: string
  name: string
  modalityCode: string
  bodyPart: string
  views?: string | null
  description?: string | null
}

export function RadiologyCatalogPanel() {
  const queryClient = useQueryClient()
  const [importSummary, setImportSummary] = useState<string | null>(null)
  const { data: modalities = [], isLoading } = useQuery({
    queryKey: ['radiology-modalities'],
    queryFn: () => apiRequest<Modality[]>('/radiology/modalities'),
  })
  const { data: studies = [], isLoading: studiesLoading } = useQuery({
    queryKey: ['radiology-studies'],
    queryFn: () => apiRequest<Study[]>('/radiology/studies'),
  })

  const createModality = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/radiology/modalities', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          code: form.get('code'),
        }),
      })
    },
    onSuccess: async () => {
      notify('Modality added', 'Radiology catalog updated.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['radiology-modalities'] })
    },
  })

  const importCatalog = useMutation({
    mutationFn: (csv: string) =>
      apiRequest<{
        modalitiesCreated: number
        modalitiesSkipped: number
        studiesCreated: number
        studiesSkipped: number
        errors: string[]
      }>('/radiology/modalities/import', {
        method: 'POST',
        body: JSON.stringify({ csv }),
      }),
    onSuccess: async (summary) => {
      const message = `Modalities +${summary.modalitiesCreated} / studies +${summary.studiesCreated}${
        summary.errors.length ? ` · ${summary.errors.length} row warning(s)` : ''
      }`
      setImportSummary(message)
      notify('Catalog imported', message, summary.errors.length ? 'warning' : 'success')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['radiology-modalities'] }),
        queryClient.invalidateQueries({ queryKey: ['radiology-studies'] }),
      ])
    },
    onError: (error: Error) => notify('Import failed', error.message, 'critical'),
  })

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <PageHeader
          title="Bulk import (onboarding)"
          description="Download the CSV template, add modalities and standard study protocols, then import in one step."
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const link = document.createElement('a')
              link.href = '/templates/radiology-catalog-import-template.csv'
              link.download = 'radiology-catalog-import-template.csv'
              link.click()
            }}
          >
            <Download className="h-4 w-4" />
            Download CSV template
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Upload className="h-4 w-4" />
            {importCatalog.isPending ? 'Importing…' : 'Upload filled CSV'}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const csv = await file.text()
                importCatalog.mutate(csv)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Columns: record_type (modality|study), modality_code, name, code, body_part, views, description.
          Modality rows omit modality_code; study rows require an existing or preceding modality code.
        </p>
        {importSummary ? <Alert tone="info" className="mt-4">{importSummary}</Alert> : null}
      </Card>

      <Card className="p-8">
        <PageHeader
          title="Radiology catalog"
          description="Imaging modalities and standard study protocols for ordering and worklist routing."
        />
        {isLoading ? (
          <div className="mt-6 h-32 animate-skeleton rounded-xl" />
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                Modalities ({modalities.length})
              </h3>
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {modalities.map((modality) => (
                  <li key={modality.id} className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="font-semibold">{modality.name}</p>
                    <p className="text-xs text-slate-500">{modality.code}</p>
                  </li>
                ))}
                {!modalities.length ? <p className="text-sm text-slate-500">No modalities configured.</p> : null}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                Study protocols ({studies.length})
              </h3>
              {studiesLoading ? (
                <div className="mt-3 h-24 animate-skeleton rounded-xl" />
              ) : (
                <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                  {studies.map((study) => (
                    <li key={study.code} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
                      <p className="font-semibold">{study.name}</p>
                      <p className="text-xs text-slate-500">
                        {study.code} · {study.modalityCode} · {study.bodyPart}
                        {study.views ? ` · ${study.views}` : ''}
                      </p>
                    </li>
                  ))}
                  {!studies.length ? (
                    <p className="text-sm text-slate-500">Import study rows from the CSV template.</p>
                  ) : null}
                </ul>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <PageHeader title="Add modality" description="X-Ray, ultrasound, CT, MRI, etc." />
        <ClinicalForm className="mt-6" onSubmit={(e) => submitClinicalForm(createModality, e)}>
          <FormSection title="Modality details" columns={1}>
            <Field name="name" label="Modality name" required placeholder="X-Ray" />
            <Field name="code" label="Code" required placeholder="XR" />
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
