import { formDataFromElement } from '../../lib/form-utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowLeft } from 'lucide-react'
import { Button, Card, Field, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'
import { bedStatusStyles } from './ipd-utils'

export function IpdAdminSetup({ onBack }: { onBack?: () => void }) {
  const queryClient = useQueryClient()

  const { data: beds = [] } = useQuery({
    queryKey: ['bed-dashboard'],
    queryFn: () =>
      apiRequest<
        {
          id: string
          bedNo: string
          status: string
          type: string
          ward: { name: string }
          patient?: { firstName: string; lastName: string } | null
        }[]
      >('/inpatient/beds/dashboard'),
  })
  const { data: wards = [] } = useQuery({
    queryKey: ['wards'],
    queryFn: () => apiRequest<{ id: string; name: string }[]>('/inpatient/wards'),
  })

  const createWard = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/inpatient/wards', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          code: form.get('code'),
          type: form.get('type'),
          floor: form.get('floor'),
        }),
      })
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['wards'] }),
  })

  const createBed = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/inpatient/beds', {
        method: 'POST',
        body: JSON.stringify({
          wardId: form.get('wardId'),
          bedNo: form.get('bedNo'),
          type: form.get('type'),
        }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bed-dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['wards'] })
      await queryClient.invalidateQueries({ queryKey: ['ipd-dashboard'] })
    },
  })

  const updateBedStatus = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest(`/inpatient/beds/${form.get('bedId')}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: form.get('status') }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bed-dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['available-beds'] })
      await queryClient.invalidateQueries({ queryKey: ['ipd-dashboard'] })
    },
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {onBack ? (
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Button>
      ) : null}

      <PageHeader
        title="Ward & bed management"
        description="Visual bed board and ward setup — color-coded cards, not tables."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="text-lg font-bold">Create ward</h3>
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              createWard.mutate(event.currentTarget)
              event.currentTarget.reset()
            }}
          >
            <Field name="name" label="Ward name" required />
            <Field name="code" label="Ward code" required />
            <label>
              <span className="text-sm font-semibold">Type</span>
              <select name="type" className="input mt-2" required>
                <option value="general">General</option>
                <option value="icu">ICU</option>
                <option value="hdu">HDU</option>
                <option value="maternity">Maternity</option>
                <option value="paediatric">Paediatric</option>
                <option value="surgical">Surgical</option>
                <option value="medical">Medical</option>
                <option value="isolation">Isolation</option>
              </select>
            </label>
            <Field name="floor" label="Floor" />
            <Button type="submit">Create ward</Button>
          </form>
        </Card>

        <Card>
          <h3 className="text-lg font-bold">Create bed</h3>
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              createBed.mutate(event.currentTarget)
              event.currentTarget.reset()
            }}
          >
            <label>
              <span className="text-sm font-semibold">Ward</span>
              <select name="wardId" className="input mt-2" required>
                <option value="">Select ward</option>
                {wards.map((ward) => (
                  <option key={ward.id} value={ward.id}>
                    {ward.name}
                  </option>
                ))}
              </select>
            </label>
            <Field name="bedNo" label="Bed number" required />
            <label>
              <span className="text-sm font-semibold">Bed type</span>
              <select name="type" className="input mt-2" required>
                <option value="standard">Standard</option>
                <option value="icu">ICU</option>
                <option value="isolation">Isolation</option>
                <option value="paediatric">Paediatric</option>
                <option value="maternity">Maternity</option>
                <option value="cardiac">Cardiac</option>
              </select>
            </label>
            <Button type="submit">Create bed</Button>
          </form>
        </Card>
      </div>

      <div>
        <h3 className="mb-4 text-lg font-bold">Bed board</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {beds.map((bed) => (
            <div
              key={bed.id}
              className={clsx(
                'rounded-2xl border border-l-4 bg-white p-4 shadow-sm',
                bedStatusStyles[bed.status] ?? 'border-l-slate-300',
              )}
            >
              <p className="text-xl font-bold">{bed.bedNo}</p>
              <p className="text-xs uppercase text-slate-500">{bed.ward.name}</p>
              <p className="mt-2 text-sm font-semibold capitalize text-slate-700">{bed.status}</p>
              {bed.patient ? (
                <p className="mt-1 text-sm text-slate-600">
                  {bed.patient.firstName} {bed.patient.lastName}
                </p>
              ) : null}
              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  updateBedStatus.mutate(event.currentTarget)
                }}
              >
                <input type="hidden" name="bedId" value={bed.id} />
                <select name="status" className="input flex-1 text-xs" defaultValue={bed.status}>
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="reserved">Reserved</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="maintenance">Maintenance</option>
                </select>
                <Button type="submit" variant="secondary" className="text-xs">
                  Update
                </Button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
