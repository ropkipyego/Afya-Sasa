import { useState } from 'react'
import { formDataFromElement } from '../../lib/form-utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PartographChart } from './PartographChart'
import clsx from 'clsx'
import { AlertTriangle, Baby } from 'lucide-react'
import { Button, Card, Field, PageHeader, SelectField, TextareaField } from '../ui'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'

type PregnancyRow = {
  id: string
  status: string
  patient: { firstName: string; lastName: string; patientNo: string }
}

type PregnancyDetail = {
  id: string
  deliveries?: { id: string; deliveryTime: string; mode: string }[]
  newborns?: { id: string; tempName: string | null; babyName: string | null; sex: string; birthWeightGrams: number; babyPatient?: { patientNo: string } | null }[]
  partographEntries?: {
    id: string
    recordedAt: string
    cervicalDilationCm: string | null
    fetalHeartRate: number | null
    alertFlag: boolean
    alertMessage: string | null
  }[]
}

export function LabourWardWorkspace({ mode }: { mode: 'labour' | 'deliveries' }) {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState('')

  const { data: pregnancies = [] } = useQuery({
    queryKey: ['pregnancies'],
    queryFn: () => apiRequest<PregnancyRow[]>('/maternity/pregnancies'),
  })

  const { data: detail } = useQuery({
    queryKey: ['pregnancy-detail', selectedId],
    queryFn: () => apiRequest<PregnancyDetail>(`/maternity/pregnancies/${selectedId}`),
    enabled: Boolean(selectedId),
  })

  const partograph = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest(`/maternity/pregnancies/${selectedId}/partograph`, {
        method: 'POST',
        body: JSON.stringify({
          cervicalDilationCm: form.get('cervicalDilationCm') ? Number(form.get('cervicalDilationCm')) : undefined,
          contractionsPer10Min: form.get('contractionsPer10Min') ? Number(form.get('contractionsPer10Min')) : undefined,
          fetalHeartRate: form.get('fetalHeartRate') ? Number(form.get('fetalHeartRate')) : undefined,
          maternalPulse: form.get('maternalPulse') ? Number(form.get('maternalPulse')) : undefined,
          bpSystolic: form.get('bpSystolic') ? Number(form.get('bpSystolic')) : undefined,
          bpDiastolic: form.get('bpDiastolic') ? Number(form.get('bpDiastolic')) : undefined,
          temperatureC: form.get('temperatureC') ? Number(form.get('temperatureC')) : undefined,
          notes: form.get('notes') || undefined,
        }),
      })
    },
    onSuccess: async (entry) => {
      const row = entry as { alertFlag?: boolean; alertMessage?: string | null }
      if (row.alertFlag) notify('Partograph alert', row.alertMessage ?? 'Review labour progress.', 'warning')
      else notify('Partograph entry saved', '', 'success')
      await queryClient.invalidateQueries({ queryKey: ['pregnancy-detail', selectedId] })
    },
  })

  const createDelivery = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest(`/maternity/pregnancies/${selectedId}/deliveries`, {
        method: 'POST',
        body: JSON.stringify({
          deliveryTime: form.get('deliveryTime'),
          mode: form.get('mode'),
          outcome: form.get('outcome'),
          complications: form.get('complications') || undefined,
        }),
      })
    },
    onSuccess: async () => {
      notify('Delivery recorded', '', 'success')
      await queryClient.invalidateQueries({ queryKey: ['pregnancy-detail', selectedId] })
      await queryClient.invalidateQueries({ queryKey: ['pregnancies'] })
    },
  })

  const registerNewborn = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      const deliveryId = detail?.deliveries?.[0]?.id
      if (!deliveryId) throw new Error('Record delivery first.')
      return apiRequest(`/maternity/deliveries/${deliveryId}/register-newborn-patient`, {
        method: 'POST',
        body: JSON.stringify({
          sex: form.get('sex'),
          birthWeightGrams: Number(form.get('birthWeightGrams') || 0),
          apgar1Min: Number(form.get('apgar1Min') || 0),
          apgar5Min: Number(form.get('apgar5Min') || 0),
          babyName: form.get('babyName') || undefined,
          birthOrder: Number(form.get('birthOrder') || 1),
          multipleBirth: form.get('multipleBirth') || 'singleton',
          status: 'alive',
        }),
      })
    },
    onSuccess: async (result) => {
      const row = result as { babyPatient: { patientNo: string } }
      notify('Newborn registered', `MRN ${row.babyPatient.patientNo} created and linked to mother.`, 'success')
      await queryClient.invalidateQueries({ queryKey: ['pregnancy-detail', selectedId] })
      await queryClient.invalidateQueries({ queryKey: ['mother-baby-registry'] })
    },
  })

  const active = pregnancies.filter((p) => p.status === 'active' || p.status === 'delivered')

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <Card>
        <PageHeader title={mode === 'labour' ? 'Labour ward' : 'Deliveries'} />
        <div className="mt-3 space-y-2">
          {active.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              className={clsx(
                'card-hover w-full rounded-xl border px-4 py-3 text-left',
                selectedId === p.id ? 'border-pink-400 bg-pink-50' : 'border-slate-200',
              )}
            >
              <p className="font-semibold">{p.patient.firstName} {p.patient.lastName}</p>
              <p className="text-xs capitalize text-slate-500">{p.status}</p>
            </button>
          ))}
        </div>
      </Card>

      {selectedId && detail ? (
        <div className="space-y-4">
          {mode === 'labour' ? (
            <Card className="p-5 md:p-6">
              <PageHeader title="Digital partograph" description="Alerts when labour deviates from normal." />
              <div className="mt-4">
                <PartographChart entries={detail.partographEntries ?? []} />
              </div>
              <div className="mt-4 space-y-2">
                {(detail.partographEntries ?? []).map((e) => (
                  <div
                    key={e.id}
                    className={clsx(
                      'rounded-xl border p-3 text-sm',
                      e.alertFlag ? 'border-amber-300 bg-amber-50' : 'border-slate-200',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {e.alertFlag ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : null}
                      <span className="font-medium">{new Date(e.recordedAt).toLocaleString()}</span>
                    </div>
                    <p>Cervix {e.cervicalDilationCm ?? '—'}cm · FHR {e.fetalHeartRate ?? '—'}</p>
                    {e.alertMessage ? <p className="text-amber-800">{e.alertMessage}</p> : null}
                  </div>
                ))}
              </div>
              <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); partograph.mutate(e.currentTarget) }}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field name="cervicalDilationCm" label="Cervical dilatation (cm)" type="number" step="0.5" />
                  <Field name="contractionsPer10Min" label="Contractions / 10 min" type="number" />
                  <Field name="fetalHeartRate" label="Fetal heart rate" type="number" />
                  <Field name="maternalPulse" label="Maternal pulse" type="number" />
                  <Field name="bpSystolic" label="BP systolic" type="number" />
                  <Field name="bpDiastolic" label="BP diastolic" type="number" />
                  <Field name="temperatureC" label="Temperature (°C)" type="number" step="0.1" />
                </div>
                <TextareaField name="notes" label="Notes" />
                <Button type="submit" loading={partograph.isPending}>Add partograph entry</Button>
              </form>
            </Card>
          ) : null}

          {mode === 'deliveries' ? (
            <>
              <Card>
                <PageHeader title="Delivery record" />
                <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); createDelivery.mutate(e.currentTarget) }}>
                  <Field name="deliveryTime" label="Delivery date & time" type="datetime-local" required />
                  <SelectField name="mode" label="Delivery type" required>
                    <option value="svd">Normal delivery (SVD)</option>
                    <option value="assisted">Assisted delivery</option>
                    <option value="cesarean">Caesarean section</option>
                    <option value="breech">Breech</option>
                  </SelectField>
                  <SelectField name="outcome" label="Outcome" required>
                    <option value="live_birth">Live birth</option>
                    <option value="stillbirth">Stillbirth</option>
                    <option value="maternal_transfer">Maternal transfer</option>
                    <option value="maternal_death">Maternal death</option>
                  </SelectField>
                  <TextareaField name="complications" label="Complications" />
                  <Button type="submit" loading={createDelivery.isPending}>Record delivery</Button>
                </form>
              </Card>

              <Card>
                <PageHeader title="Register newborn" description="Creates a separate patient record (MRN) and permanent mother-baby link." />
                <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); registerNewborn.mutate(e.currentTarget) }}>
                  <SelectField name="sex" label="Sex" required>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="unknown">Unknown</option>
                  </SelectField>
                  <Field name="birthWeightGrams" label="Birth weight (g)" type="number" required />
                  <Field name="apgar1Min" label="APGAR 1 min" type="number" min={0} max={10} />
                  <Field name="apgar5Min" label="APGAR 5 min" type="number" min={0} max={10} />
                  <Field name="babyName" label="Baby name (optional)" placeholder="Leave blank for Baby Of Mother Name" />
                  <Field name="birthOrder" label="Birth order" type="number" min={1} defaultValue={1} />
                  <SelectField name="multipleBirth" label="Multiple birth" defaultValue="singleton">
                    <option value="singleton">Singleton</option>
                    <option value="twin">Twin</option>
                    <option value="triplet">Triplet</option>
                    <option value="higher_order">Higher order</option>
                  </SelectField>
                  <Button type="submit" loading={registerNewborn.isPending}>
                    <Baby className="h-4 w-4" />
                    Register newborn patient
                  </Button>
                </form>
                <div className="mt-4 space-y-2">
                  {(detail.newborns ?? []).map((n) => (
                    <div key={n.id} className="rounded-xl border border-pink-200 bg-pink-50 p-3 text-sm">
                      <p className="font-semibold">{n.babyName ?? n.tempName ?? 'Unnamed baby'}</p>
                      <p>{n.sex} · {n.birthWeightGrams}g · MRN {n.babyPatient?.patientNo ?? 'pending'}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : null}
        </div>
      ) : (
        <Card><p className="py-20 text-center text-slate-500">Select a mother in labour.</p></Card>
      )}
    </div>
  )
}
