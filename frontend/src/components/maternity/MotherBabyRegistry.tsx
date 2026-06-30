import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { Button, Card, Field, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'

type RegistryRow = {
  id: string
  birthDate: string
  deliveryType: string
  birthOrder: number
  multipleBirth: string
  motherPatient: { patientNo: string; firstName: string; lastName: string }
  babyPatient: { patientNo: string; firstName: string; lastName: string; id: string }
  newborn: { id: string; tempName: string | null; babyName: string | null } | null
}

export function MotherBabyRegistry() {
  const queryClient = useQueryClient()
  const [renamingId, setRenamingId] = useState<string | null>(null)

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['mother-baby-registry'],
    queryFn: () => apiRequest<RegistryRow[]>('/maternity/mother-baby-registry'),
  })

  const rename = useMutation({
    mutationFn: ({ newbornId, babyName }: { newbornId: string; babyName: string }) =>
      apiRequest(`/maternity/newborns/${newbornId}/rename`, {
        method: 'PATCH',
        body: JSON.stringify({ babyName }),
      }),
    onSuccess: async () => {
      notify('Baby renamed', 'Patient record updated.', 'success')
      setRenamingId(null)
      await queryClient.invalidateQueries({ queryKey: ['mother-baby-registry'] })
    },
  })

  return (
    <Card className="p-5 md:p-8">
      <PageHeader
        title="Mother-baby registry"
        description="Permanent links between mother MRN and baby MRN. Rename unnamed babies when parents choose a name."
      />
      {isLoading ? (
        <p className="mt-4 text-sm text-slate-500">Loading registry…</p>
      ) : (
        <div className="mt-6 space-y-4">
          {links.map((row) => (
            <article key={row.id} className="card-hover rounded-2xl border border-pink-200 bg-pink-50/30 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">Mother</p>
                  <p className="font-semibold">{row.motherPatient.firstName} {row.motherPatient.lastName}</p>
                  <p className="text-xs text-slate-500">{row.motherPatient.patientNo}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">Baby</p>
                  <p className="font-semibold">
                    {row.newborn?.babyName ?? row.newborn?.tempName ?? `${row.babyPatient.firstName} ${row.babyPatient.lastName}`}
                  </p>
                  <p className="text-xs text-slate-500">{row.babyPatient.patientNo}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-600">
                {row.birthDate} · {row.deliveryType} · {row.multipleBirth}
                {row.birthOrder > 1 ? ` #${row.birthOrder}` : ''}
              </p>
              {row.newborn ? (
                renamingId === row.newborn.id ? (
                  <form
                    className="mt-4 flex flex-wrap items-end gap-3"
                    onSubmit={(e: FormEvent<HTMLFormElement>) => {
                      e.preventDefault()
                      const name = new FormData(e.currentTarget).get('babyName')?.toString()
                      if (name) rename.mutate({ newbornId: row.newborn!.id, babyName: name })
                    }}
                  >
                    <Field name="babyName" label="Official baby name" required />
                    <Button type="submit" loading={rename.isPending}>Save name</Button>
                    <Button type="button" variant="ghost" onClick={() => setRenamingId(null)}>Cancel</Button>
                  </form>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-4"
                    onClick={() => setRenamingId(row.newborn!.id)}
                  >
                    <Pencil className="h-4 w-4" />
                    Rename baby
                  </Button>
                )
              ) : null}
            </article>
          ))}
          {!links.length ? <p className="py-8 text-center text-slate-500">No mother-baby links yet.</p> : null}
        </div>
      )}
    </Card>
  )
}
