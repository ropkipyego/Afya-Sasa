import { formDataFromElement } from '../../lib/form-utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Field, PageHeader, SelectField, TextareaField } from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'
import { useState } from 'react'

type UnitAdmission = {
  id: string
  unit: string
  admittedAt: string
  clinicalSummary: string | null
  feedingStatus: string | null
  oxygenSupport: string | null
  incubatorStatus: string | null
  weightGrams: number | null
  patient: { firstName: string; lastName: string; patientNo: string }
}

export function MaternityUnitBoard({ unit, title }: { unit: string; title: string }) {
  const queryClient = useQueryClient()
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchItem | null>(null)

  const { data: admissions = [] } = useQuery({
    queryKey: ['maternity-units', unit],
    queryFn: () => apiRequest<UnitAdmission[]>(`/maternity/units?unit=${unit}`),
    refetchInterval: 30_000,
  })

  const admit = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/maternity/units/admit', {
        method: 'POST',
        body: JSON.stringify({
          patientId: selectedPatient?.id,
          unit,
          clinicalSummary: form.get('clinicalSummary') || undefined,
          feedingStatus: form.get('feedingStatus') || undefined,
          oxygenSupport: form.get('oxygenSupport') || undefined,
          incubatorStatus: form.get('incubatorStatus') || undefined,
          weightGrams: form.get('weightGrams') ? Number(form.get('weightGrams')) : undefined,
          notes: form.get('notes') || undefined,
        }),
      })
    },
    onSuccess: async () => {
      notify('Admitted to unit', `${title} updated.`, 'success')
      await queryClient.invalidateQueries({ queryKey: ['maternity-units', unit] })
    },
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <Card>
        <PageHeader title={title} description={`Active patients in ${title.toLowerCase()}.`} />
        <div className="mt-4 space-y-2">
          {admissions.map((a) => (
            <div key={a.id} className="rounded-xl border border-pink-200 bg-pink-50/50 p-4">
              <p className="font-semibold">{a.patient.firstName} {a.patient.lastName}</p>
              <p className="text-xs text-slate-500">{a.patient.patientNo} · admitted {new Date(a.admittedAt).toLocaleDateString()}</p>
              {a.clinicalSummary ? <p className="mt-2 text-sm">{a.clinicalSummary}</p> : null}
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                {a.feedingStatus ? <span>Feeding: {a.feedingStatus}</span> : null}
                {a.oxygenSupport ? <span>O₂: {a.oxygenSupport}</span> : null}
                {a.incubatorStatus ? <span>Incubator: {a.incubatorStatus}</span> : null}
                {a.weightGrams ? <span>Weight: {a.weightGrams}g</span> : null}
              </div>
            </div>
          ))}
          {!admissions.length ? <p className="text-sm text-slate-500">No active admissions.</p> : null}
        </div>
      </Card>

      <Card>
        <PageHeader title={`Admit to ${title}`} />
        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); admit.mutate(e.currentTarget) }}>
          <PatientSearchAutocomplete selected={selectedPatient} onSelect={setSelectedPatient} />
          <TextareaField name="clinicalSummary" label="Clinical summary" />
          {(unit === 'nursery' || unit === 'nicu' || unit === 'postnatal') && (
            <SelectField name="feedingStatus" label="Feeding status">
              <option value="">—</option>
              <option value="breastfeeding">Breastfeeding</option>
              <option value="formula">Formula</option>
              <option value="mixed">Mixed</option>
              <option value="nil_by_mouth">Nil by mouth</option>
            </SelectField>
          )}
          {unit === 'nicu' && (
            <>
              <Field name="oxygenSupport" label="Oxygen support" placeholder="Room air, nasal cannula, CPAP…" />
              <Field name="incubatorStatus" label="Incubator status" />
            </>
          )}
          <Field name="weightGrams" label="Weight (grams)" type="number" />
          <TextareaField name="notes" label="Notes" />
          <Button type="submit" loading={admit.isPending} disabled={!selectedPatient}>Admit patient</Button>
        </form>
      </Card>
    </div>
  )
}
