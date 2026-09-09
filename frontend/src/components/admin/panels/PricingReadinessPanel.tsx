import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Wallet } from 'lucide-react'
import { Alert, Card, PageHeader } from '../../ui'
import { formatKes } from '../../../lib/clinical-catalog'
import { apiRequest } from '../../../lib/api'
import { notify } from '../../../lib/notify'
import { useAuthStore } from '../../../lib/auth-store'

type OrgClinic = {
  id: string
  name: string
  code: string
  active: boolean
  consultationFee?: string | number
  department?: { id: string; name: string } | null
}

export function PricingReadinessPanel() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const isDirector =
    user?.roles.includes('administrator') ||
    user?.roles.includes('superadmin') ||
    user?.permissions.includes('settings:manage')

  const clinicsQuery = useQuery({
    queryKey: ['admin-clinics'],
    queryFn: () => apiRequest<OrgClinic[]>('/admin/clinics'),
    enabled: isDirector,
  })
  const clinics = clinicsQuery.data ?? []

  const updateFee = useMutation({
    mutationFn: ({ id, consultationFee }: { id: string; consultationFee: number }) =>
      apiRequest(`/admin/clinics/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ consultationFee }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-clinics'] }),
        queryClient.invalidateQueries({ queryKey: ['clinical-catalog'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-settings'] }),
      ])
      notify('Clinic fee saved', 'OPD check-in and cashier now use this amount.', 'success')
    },
    onError: (error: Error) => notify('Could not save fee', error.message, 'critical'),
  })

  if (!isDirector) {
    return (
      <Card className="p-8">
        <PageHeader
          title="Clinic consultation fees"
          description="Only hospital directors and administrators can change clinic amounts."
        />
        <Alert tone="info" className="mt-6">
          You do not have access to edit clinic fees. Reception and cashier still see the mapped
          amounts on OPD check-in and Payments.
        </Alert>
      </Card>
    )
  }

  return (
    <Card className="p-8">
      <PageHeader
        title="Clinic consultation fees"
        description="Each clinic has a KES amount stored in the hospital database. Reception and cashier use this exact figure — they do not invent a price."
      />

      <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950">
        <Wallet className="mb-2 inline h-4 w-4" /> Change a fee here and it appears on OPD check-in
        and the Payments desk as soon as the catalog refreshes. Lab, radiology, and pharmacy item
        price lists are still entered at the cashier when those catalogs are priced.
      </div>

      <div className="mt-8 space-y-3">
        {clinicsQuery.isLoading ? <p className="text-sm text-slate-500">Loading clinics…</p> : null}
        {clinics.map((clinic) => (
          <div
            key={clinic.id}
            className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 p-4"
          >
            <div>
              <p className="font-semibold text-slate-900">{clinic.name}</p>
              <p className="text-xs text-slate-500">
                {clinic.department?.name ?? 'No department'} · {clinic.active ? 'Active' : 'Inactive'}{' '}
                · current {formatKes(clinic.consultationFee)}
              </p>
            </div>
            <label className="block text-xs font-semibold text-slate-600">
              Consultation fee (KES)
              <input
                type="number"
                min={0}
                className="input mt-1 w-40"
                defaultValue={Number(clinic.consultationFee ?? 0)}
                onBlur={(e) => {
                  const next = Number(e.target.value)
                  if (Number.isFinite(next) && next !== Number(clinic.consultationFee ?? 0)) {
                    updateFee.mutate({ id: clinic.id, consultationFee: next })
                  }
                }}
              />
            </label>
          </div>
        ))}
        {!clinicsQuery.isLoading && !clinics.length ? (
          <Alert tone="warning">
            No clinics in the database yet. Add them under Departments & clinics first.
          </Alert>
        ) : null}
      </div>
    </Card>
  )
}
