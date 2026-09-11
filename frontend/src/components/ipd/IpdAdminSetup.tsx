import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { Alert, Button, Card, Field, PageHeader } from '../ui'
import { apiRequest, getApiErrorStatus } from '../../lib/api'
import { notify } from '../../lib/notify'
import { useAuthStore } from '../../lib/auth-store'
import {
  BED_STATUS_LABELS,
  BED_STATUSES_SETTABLE,
  BED_TYPES,
  WARD_TYPES,
  bedStatusStyles,
  wardTypeLabel,
} from './ipd-utils'

type WardRow = {
  id: string
  name: string
  code: string
  type: string
  floor: string | null
  active: boolean
  bedCount: number
  physicalBeds: number
  configuredCapacity: number
  available: number
  occupied: number
  reserved: number
  maintenance: number
  cleaning: number
  inactive: number
}

type BedRow = {
  id: string
  bedNo: string
  status: string
  type: string
  ward: { id: string; name: string }
  patient?: { firstName: string; lastName: string } | null
}

type WardPayload = {
  name: string
  code: string
  type: string
  floor?: string
}

type BedPayload = {
  wardId: string
  bedNo: string
  type: string
}

function mutationErrorMessage(
  error: unknown,
  kind: 'ward' | 'bed',
  action: 'create' | 'save' = 'save',
) {
  const status = getApiErrorStatus(error)
  const fallback =
    kind === 'ward'
      ? 'Unable to save ward. Please try again or contact an administrator.'
      : 'Unable to save bed. Please try again or contact an administrator.'
  if (status === 403) {
    if (action === 'create') {
      return kind === 'ward'
        ? 'You do not have permission to create wards.'
        : 'You do not have permission to create beds.'
    }
    return kind === 'ward'
      ? 'You do not have permission to manage wards.'
      : 'You do not have permission to manage beds.'
  }
  if (status === 400 || status === 404 || status === 409) {
    return error instanceof Error ? error.message : fallback
  }
  if (status === 500 || status === 502 || status === 503) return fallback
  return error instanceof Error ? error.message : fallback
}

export function IpdAdminSetup({ onBack }: { onBack?: () => void }) {
  const queryClient = useQueryClient()
  const permissions = useAuthStore((state) => state.user?.permissions ?? [])
  const canManageWards = permissions.includes('wards:manage')
  const canManageBeds = permissions.includes('beds:manage')
  const canManageSetup = canManageWards || canManageBeds

  const wardFormRef = useRef<HTMLFormElement>(null)
  const bedFormRef = useRef<HTMLFormElement>(null)
  const [editingWard, setEditingWard] = useState<WardRow | null>(null)

  const {
    data: beds = [],
    isLoading: bedsLoading,
    isError: bedsError,
    error: bedsQueryError,
    refetch: refetchBeds,
  } = useQuery({
    queryKey: ['bed-dashboard'],
    queryFn: () => apiRequest<BedRow[]>('/inpatient/beds/dashboard'),
    enabled: canManageSetup,
  })
  const {
    data: wards = [],
    isLoading: wardsLoading,
    isError: wardsError,
    error: wardsQueryError,
    refetch: refetchWards,
  } = useQuery({
    queryKey: ['wards'],
    queryFn: () => apiRequest<WardRow[]>('/inpatient/wards'),
    enabled: canManageSetup,
  })

  const refreshLists = async () => {
    await queryClient.invalidateQueries({ queryKey: ['wards'] })
    await queryClient.invalidateQueries({ queryKey: ['bed-dashboard'] })
    await queryClient.invalidateQueries({ queryKey: ['ipd-dashboard'] })
    await queryClient.invalidateQueries({ queryKey: ['available-beds'] })
    await queryClient.invalidateQueries({ queryKey: ['ward-census'] })
  }

  const createWard = useMutation({
    mutationFn: (payload: WardPayload) =>
      apiRequest<{ id: string; name: string }>('/inpatient/wards', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async (created) => {
      if (!created?.id) {
        notify('Ward not saved', 'The server did not return a ward ID. Refresh and check the list.', 'critical')
        return
      }
      notify('Ward created successfully.', `${created.name} is now available.`, 'success')
      wardFormRef.current?.reset()
      await refreshLists()
    },
    onError: (error: Error) => {
      notify('Could not create ward', mutationErrorMessage(error, 'ward', 'create'), 'critical')
    },
  })

  const updateWard = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: WardPayload & { active?: boolean } }) =>
      apiRequest(`/inpatient/wards/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      notify('Ward updated', 'Ward details were saved.', 'success')
      setEditingWard(null)
      await refreshLists()
    },
    onError: (error: Error) => {
      notify('Could not update ward', mutationErrorMessage(error, 'ward'), 'critical')
    },
  })

  const createBed = useMutation({
    mutationFn: (payload: BedPayload) =>
      apiRequest<{ id: string; bedNo: string }>('/inpatient/beds', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async (created) => {
      if (!created?.id) {
        notify('Bed not saved', 'The server did not return a bed ID. Refresh and check the board.', 'critical')
        return
      }
      notify('Bed created successfully.', `${created.bedNo} is now on the bed board.`, 'success')
      bedFormRef.current?.reset()
      await refreshLists()
    },
    onError: (error: Error) => {
      notify('Could not create bed', mutationErrorMessage(error, 'bed', 'create'), 'critical')
    },
  })

  const updateBedStatus = useMutation({
    mutationFn: ({ bedId, status }: { bedId: string; status: string }) =>
      apiRequest(`/inpatient/beds/${bedId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: async () => {
      notify('Bed updated', 'Bed status saved.', 'success')
      await refreshLists()
    },
    onError: (error: Error) => {
      notify('Could not update bed', mutationErrorMessage(error, 'bed'), 'critical')
    },
  })

  const deleteBed = useMutation({
    mutationFn: (bedId: string) => apiRequest(`/inpatient/beds/${bedId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      notify('Bed removed', 'The bed record was deactivated.', 'success')
      await refreshLists()
    },
    onError: (error: Error) => notify('Could not remove bed', error.message, 'critical'),
  })

  const deleteWard = useMutation({
    mutationFn: (wardId: string) => apiRequest(`/inpatient/wards/${wardId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      notify('Ward removed', 'The ward was deactivated. Clinical history was not deleted.', 'success')
      await refreshLists()
    },
    onError: (error: Error) => notify('Could not remove ward', error.message, 'critical'),
  })

  const submitWardCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (createWard.isPending || !canManageWards) return
    const form = new FormData(event.currentTarget)
    const floor = String(form.get('floor') ?? '').trim()
    createWard.mutate({
      name: String(form.get('name') ?? '').trim(),
      code: String(form.get('code') ?? '').trim(),
      type: String(form.get('type') ?? ''),
      ...(floor ? { floor } : {}),
    })
  }

  const submitBedCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (createBed.isPending || !canManageBeds) return
    const form = new FormData(event.currentTarget)
    createBed.mutate({
      wardId: String(form.get('wardId') ?? '').trim(),
      bedNo: String(form.get('bedNo') ?? '').trim(),
      type: String(form.get('type') ?? ''),
    })
  }

  const submitWardEdit = (event: React.FormEvent<HTMLFormElement>, ward: WardRow) => {
    event.preventDefault()
    if (updateWard.isPending || !canManageWards) return
    const form = new FormData(event.currentTarget)
    const floor = String(form.get('floor') ?? '').trim()
    updateWard.mutate({
      id: ward.id,
      payload: {
        name: String(form.get('name') ?? '').trim(),
        code: String(form.get('code') ?? '').trim(),
        type: String(form.get('type') ?? ''),
        ...(floor ? { floor } : {}),
      },
    })
  }

  const toggleWardActive = (ward: WardRow) => {
    if (!canManageWards || updateWard.isPending) return
    if (ward.active) {
      const occupancyNote =
        ward.occupied > 0
          ? ` This ward currently has ${ward.occupied} occupied bed(s). Deactivation is blocked until patients are discharged or transferred.`
          : ward.physicalBeds > 0
            ? ` ${ward.physicalBeds} physical bed record(s) stay on file and are not deleted.`
            : ''
      if (!window.confirm(`Deactivate ${ward.name}?${occupancyNote}`)) return
      updateWard.mutate({ id: ward.id, payload: { name: ward.name, code: ward.code, type: ward.type, active: false } })
      return
    }
    updateWard.mutate({ id: ward.id, payload: { name: ward.name, code: ward.code, type: ward.type, active: true } })
  }

  if (!canManageSetup) {
    return (
      <div className="space-y-4">
        {onBack ? (
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Button>
        ) : null}
        <Alert tone="warning" title="Permission required">
          You do not have permission to manage wards and beds. Ask a hospital administrator for
          wards:manage or beds:manage access. You can still view the inpatient board if you have
          read access.
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {onBack ? (
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Button>
      ) : null}

      <PageHeader
        title="Ward & bed management"
        description="Create and maintain physical ward and bed records. Occupied beds come from admissions, not from this screen."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {canManageWards ? (
          <Card>
            <h3 className="text-lg font-bold">Create ward</h3>
            <form ref={wardFormRef} className="mt-4 space-y-3" onSubmit={submitWardCreate}>
              <Field name="name" label="Ward name" required />
              <Field name="code" label="Ward code" required />
              <label>
                <span className="text-sm font-semibold">Type</span>
                <select name="type" className="input mt-2" required>
                  {WARD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {wardTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </label>
              <Field name="floor" label="Floor" />
              <Button type="submit" loading={createWard.isPending} disabled={createWard.isPending}>
                {createWard.isPending ? 'Saving…' : 'Create ward'}
              </Button>
              {createWard.error ? (
                <Alert tone="error">{mutationErrorMessage(createWard.error, 'ward', 'create')}</Alert>
              ) : null}
            </form>
          </Card>
        ) : (
          <Alert tone="warning">You can manage beds, but you do not have permission to create wards.</Alert>
        )}

        {canManageBeds ? (
          <Card>
            <h3 className="text-lg font-bold">Create bed</h3>
            <form ref={bedFormRef} className="mt-4 space-y-3" onSubmit={submitBedCreate}>
              <label>
                <span className="text-sm font-semibold">Ward</span>
                <select name="wardId" className="input mt-2" required disabled={wardsLoading}>
                  <option value="">{wardsLoading ? 'Loading wards…' : 'Select ward'}</option>
                  {wards.map((ward) => (
                    <option key={ward.id} value={ward.id}>
                      {ward.name} ({ward.code})
                    </option>
                  ))}
                </select>
              </label>
              <Field name="bedNo" label="Bed number" required />
              <label>
                <span className="text-sm font-semibold">Bed type</span>
                <select name="type" className="input mt-2" required>
                  {BED_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" loading={createBed.isPending} disabled={createBed.isPending}>
                {createBed.isPending ? 'Saving…' : 'Create bed'}
              </Button>
              {createBed.error ? (
                <Alert tone="error">{mutationErrorMessage(createBed.error, 'bed', 'create')}</Alert>
              ) : null}
            </form>
          </Card>
        ) : (
          <Alert tone="warning">You can manage wards, but you do not have permission to create beds.</Alert>
        )}
      </div>

      <Card>
        <h3 className="text-lg font-bold">Configured wards</h3>
        {wardsLoading ? (
          <p className="mt-4 text-sm text-slate-500">Loading wards...</p>
        ) : wardsError ? (
          <div className="mt-4 space-y-3">
            <Alert tone="error">{wardsQueryError instanceof Error ? wardsQueryError.message : 'Unable to load wards.'}</Alert>
            <Button type="button" variant="secondary" onClick={() => refetchWards()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {wards.map((ward) => (
              <div key={ward.id} className="rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {ward.name}{' '}
                      <span className="text-xs font-medium uppercase text-slate-500">{ward.code}</span>
                      {!ward.active ? (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          Inactive
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Physical bed records: {ward.physicalBeds}
                      {ward.configuredCapacity !== ward.physicalBeds
                        ? ` · Configured capacity: ${ward.configuredCapacity}`
                        : ''}
                      {` · Occupied ${ward.occupied} · Available ${ward.available}`}
                    </p>
                  </div>
                  {canManageWards ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs"
                        onClick={() => setEditingWard(editingWard?.id === ward.id ? null : ward)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="text-xs"
                        loading={updateWard.isPending}
                        onClick={() => toggleWardActive(ward)}
                      >
                        {ward.active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs text-rose-700"
                        loading={deleteWard.isPending}
                        onClick={() => {
                          if (window.confirm(`Remove ward ${ward.name}? Beds are deactivated, not permanently deleted.`)) {
                            deleteWard.mutate(ward.id)
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove ward
                      </Button>
                    </div>
                  ) : null}
                </div>
                {editingWard?.id === ward.id ? (
                  <form className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4" onSubmit={(event) => submitWardEdit(event, ward)}>
                    <Field name="name" label="Ward name" defaultValue={ward.name} required />
                    <Field name="code" label="Ward code" defaultValue={ward.code} required />
                    <label>
                      <span className="text-sm font-semibold">Type</span>
                      <select name="type" className="input mt-2" defaultValue={ward.type} required>
                        {WARD_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {wardTypeLabel(type)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field name="floor" label="Floor" defaultValue={ward.floor ?? ''} />
                    <div className="flex gap-2">
                      <Button type="submit" loading={updateWard.isPending} disabled={updateWard.isPending}>
                        Save ward
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setEditingWard(null)}>
                        Cancel
                      </Button>
                    </div>
                    {updateWard.error ? (
                      <Alert tone="error">{mutationErrorMessage(updateWard.error, 'ward')}</Alert>
                    ) : null}
                  </form>
                ) : null}
              </div>
            ))}
            {!wards.length ? <p className="text-sm text-slate-500">No wards configured yet.</p> : null}
          </div>
        )}
      </Card>

      <div>
        <h3 className="mb-4 text-lg font-bold">Bed board</h3>
        {bedsLoading ? (
          <p className="text-sm text-slate-500">Loading beds...</p>
        ) : bedsError ? (
          <div className="space-y-3">
            <Alert tone="error">{bedsQueryError instanceof Error ? bedsQueryError.message : 'Unable to load beds.'}</Alert>
            <Button type="button" variant="secondary" onClick={() => refetchBeds()}>
              Retry
            </Button>
          </div>
        ) : !beds.length ? (
          <p className="text-sm text-slate-500">
            {wards.length ? 'No beds configured for this ward.' : 'No beds configured yet.'}
          </p>
        ) : (
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
                <p className="mt-2 text-sm font-semibold capitalize text-slate-700">
                  {BED_STATUS_LABELS[bed.status as keyof typeof BED_STATUS_LABELS] ?? bed.status}
                </p>
                {bed.patient ? (
                  <p className="mt-1 text-sm text-slate-600">
                    {bed.patient.firstName} {bed.patient.lastName}
                  </p>
                ) : null}
                {canManageBeds ? (
                  <form
                    className="mt-3 flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      if (updateBedStatus.isPending) return
                      const form = new FormData(event.currentTarget)
                      updateBedStatus.mutate({
                        bedId: bed.id,
                        status: String(form.get('status') ?? ''),
                      })
                    }}
                  >
                    <select
                      name="status"
                      className="input flex-1 text-xs"
                      defaultValue={BED_STATUSES_SETTABLE.includes(bed.status as (typeof BED_STATUSES_SETTABLE)[number]) ? bed.status : 'available'}
                      disabled={bed.status === 'occupied' || Boolean(bed.patient)}
                    >
                      {BED_STATUSES_SETTABLE.map((status) => (
                        <option key={status} value={status}>
                          {BED_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="submit"
                      variant="secondary"
                      className="text-xs"
                      loading={updateBedStatus.isPending}
                      disabled={bed.status === 'occupied' || Boolean(bed.patient) || updateBedStatus.isPending}
                    >
                      Update
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs text-rose-700"
                      loading={deleteBed.isPending}
                      onClick={() => {
                        if (window.confirm(`Remove bed ${bed.bedNo}?`)) deleteBed.mutate(bed.id)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                ) : null}
                {bed.status === 'occupied' || bed.patient ? (
                  <p className="mt-2 text-xs text-slate-500">Occupied by admission — discharge or transfer to free this bed.</p>
                ) : null}
                {updateBedStatus.error ? (
                  <p className="mt-2 text-xs text-rose-700">{mutationErrorMessage(updateBedStatus.error, 'bed')}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
