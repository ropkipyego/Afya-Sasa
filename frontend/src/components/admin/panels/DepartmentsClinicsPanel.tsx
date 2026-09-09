import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Stethoscope } from 'lucide-react'
import { Alert, Button, Card, Field, PageHeader } from '../../ui'
import { useClinicalCatalog } from '../../../hooks/useClinicalCatalog'
import { CONFIG_DEPENDENCY_HINTS } from '../../../lib/hospital-configuration'
import { formatKes } from '../../../lib/clinical-catalog'
import { apiRequest } from '../../../lib/api'
import { notify } from '../../../lib/notify'

type OrgDepartment = {
  id: string
  name: string
  code: string
  type: string | null
  active: boolean
}

type OrgClinic = {
  id: string
  name: string
  code: string
  departmentId: string | null
  active: boolean
  doctorIds: string[]
  consultationFee?: string | number
  department?: { id: string; name: string } | null
}

export function DepartmentsClinicsPanel() {
  const queryClient = useQueryClient()
  const { data: liveCatalog } = useClinicalCatalog()
  const staff = liveCatalog?.staffClinicians ?? []

  const departmentsQuery = useQuery({
    queryKey: ['admin-departments'],
    queryFn: () => apiRequest<OrgDepartment[]>('/admin/departments'),
  })
  const clinicsQuery = useQuery({
    queryKey: ['admin-clinics'],
    queryFn: () => apiRequest<OrgClinic[]>('/admin/clinics'),
  })

  const departments = departmentsQuery.data ?? []
  const clinics = clinicsQuery.data ?? []

  const [deptName, setDeptName] = useState('')
  const [deptCode, setDeptCode] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [clinicDepartmentId, setClinicDepartmentId] = useState('')
  const [clinicFee, setClinicFee] = useState('1000')
  const [editingClinicId, setEditingClinicId] = useState<string | null>(null)

  const invalidateOrg = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-departments'] })
    await queryClient.invalidateQueries({ queryKey: ['admin-clinics'] })
    await queryClient.invalidateQueries({ queryKey: ['clinical-catalog'] })
    await queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
  }

  const createDepartment = useMutation({
    mutationFn: () =>
      apiRequest<OrgDepartment>('/admin/departments', {
        method: 'POST',
        body: JSON.stringify({
          name: deptName.trim(),
          code: deptCode.trim() || undefined,
          type: 'clinical',
        }),
      }),
    onSuccess: async (created) => {
      setDeptName('')
      setDeptCode('')
      notify('Department saved', `${created.name} is now in the database and available hospital-wide.`, 'success')
      await invalidateOrg()
    },
    onError: (error: Error) => notify('Could not add department', error.message, 'critical'),
  })

  const updateDepartment = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest(`/admin/departments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      }),
    onSuccess: async () => {
      await invalidateOrg()
    },
    onError: (error: Error) => notify('Update failed', error.message, 'critical'),
  })

  const createClinic = useMutation({
    mutationFn: () =>
      apiRequest<OrgClinic>('/admin/clinics', {
        method: 'POST',
        body: JSON.stringify({
          name: clinicName.trim(),
          departmentId: clinicDepartmentId || undefined,
          consultationFee: Number(clinicFee) || 0,
        }),
      }),
    onSuccess: async (created) => {
      setClinicName('')
      setClinicDepartmentId('')
      setClinicFee('1000')
      notify('Clinic saved', `${created.name} will appear in OPD check-in.`, 'success')
      await invalidateOrg()
    },
    onError: (error: Error) => notify('Could not add clinic', error.message, 'critical'),
  })

  const updateClinic = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: { active?: boolean; doctorIds?: string[]; consultationFee?: number }
    }) =>
      apiRequest(`/admin/clinics/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: async () => {
      await invalidateOrg()
    },
    onError: (error: Error) => notify('Update failed', error.message, 'critical'),
  })

  const toggleDoctorOnClinic = (clinic: OrgClinic, doctorId: string) => {
    const current = clinic.doctorIds ?? []
    const doctorIds = current.includes(doctorId)
      ? current.filter((id) => id !== doctorId)
      : [...current, doctorId]
    updateClinic.mutate({ id: clinic.id, patch: { doctorIds } })
  }

  return (
    <Card className="p-8">
      <PageHeader
        title="Departments & clinics"
        description="Hospital departments and clinics are stored in the database. New rows appear immediately in OPD, appointments, and staff assignment."
      />

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold">How this works</p>
        <p className="mt-1">
          Add is saved to Postgres on click — you do not need a second Save. Departments →{' '}
          {CONFIG_DEPENDENCY_HINTS.departments.join(', ')}. Clinics → {CONFIG_DEPENDENCY_HINTS.clinics.join(', ')}.
        </p>
      </div>

      {!staff.length ? (
        <Alert tone="warning" className="mt-4">
          No clinical staff found. Add doctors in User & access management first — they will appear here for clinic
          assignment.
        </Alert>
      ) : null}

      {departmentsQuery.error || clinicsQuery.error ? (
        <Alert tone="error" className="mt-4">
          {(departmentsQuery.error as Error | undefined)?.message ||
            (clinicsQuery.error as Error | undefined)?.message}
        </Alert>
      ) : null}

      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <section>
          <h3 className="text-lg font-bold">Departments</h3>
          <p className="mt-1 text-xs text-slate-500">Operational units (OPD, Laboratory, Dental, …)</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
            <Field
              name="newDepartment"
              label="Department name"
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              placeholder="e.g. Dental"
            />
            <Field
              name="newDepartmentCode"
              label="Code (optional)"
              value={deptCode}
              onChange={(e) => setDeptCode(e.target.value)}
              placeholder="DENTAL"
            />
            <Button
              type="button"
              className="mt-7"
              variant="secondary"
              loading={createDepartment.isPending}
              disabled={!deptName.trim()}
              onClick={() => createDepartment.mutate()}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
              >
                <div>
                  <p className="font-semibold">{dept.name}</p>
                  <p className="text-xs text-slate-500">
                    {dept.code}
                    {dept.type ? ` · ${dept.type}` : ''} ·{' '}
                    {clinics.filter((clinic) => clinic.departmentId === dept.id && clinic.active).length} clinic(s) ·{' '}
                    {dept.active ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-xs"
                  loading={updateDepartment.isPending}
                  onClick={() => updateDepartment.mutate({ id: dept.id, active: !dept.active })}
                >
                  {dept.active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-lg font-bold">Clinics</h3>
          <p className="mt-1 text-xs text-slate-500">
            Shown on OPD check-in. Each clinic has a consultation amount cashiers must charge.
          </p>
          <div className="mt-4 space-y-3">
            <Field
              name="newClinic"
              label="Clinic name"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="e.g. Diabetes Clinic"
            />
            <Field
              name="newClinicFee"
              label="Consultation fee (KES)"
              type="number"
              min={0}
              value={clinicFee}
              onChange={(e) => setClinicFee(e.target.value)}
            />
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold text-slate-800">Parent department</span>
              <select
                className="input w-full"
                value={clinicDepartmentId}
                onChange={(e) => setClinicDepartmentId(e.target.value)}
              >
                <option value="">Not linked</option>
                {departments
                  .filter((d) => d.active)
                  .map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
              </select>
            </label>
            <Button
              type="button"
              variant="secondary"
              loading={createClinic.isPending}
              disabled={!clinicName.trim()}
              onClick={() => createClinic.mutate()}
            >
              <Plus className="h-4 w-4" />
              Add clinic
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {clinics.map((clinic) => {
              const assigned = clinic.doctorIds ?? []
              const isEditing = editingClinicId === clinic.id
              return (
                <div key={clinic.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{clinic.name}</p>
                      <p className="text-xs text-slate-500">
                        {clinic.department?.name ?? 'No department'} · {formatKes(clinic.consultationFee)} ·{' '}
                        {assigned.length} doctor(s) · {clinic.active ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs"
                        onClick={() => setEditingClinicId(isEditing ? null : clinic.id)}
                      >
                        <Stethoscope className="h-3.5 w-3.5" />
                        Doctors
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs"
                        loading={updateClinic.isPending}
                        onClick={() =>
                          updateClinic.mutate({ id: clinic.id, patch: { active: !clinic.active } })
                        }
                      >
                        {clinic.active ? 'Off' : 'On'}
                      </Button>
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="mt-3 space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
                      <label className="block text-xs font-semibold text-slate-600">
                        Consultation fee (KES)
                        <input
                          type="number"
                          min={0}
                          className="input mt-1"
                          defaultValue={Number(clinic.consultationFee ?? 0)}
                          onBlur={(e) => {
                            const next = Number(e.target.value)
                            if (Number.isFinite(next) && next !== Number(clinic.consultationFee ?? 0)) {
                              updateClinic.mutate({ id: clinic.id, patch: { consultationFee: next } })
                            }
                          }}
                        />
                      </label>
                      <div className="max-h-40 space-y-1 overflow-y-auto">
                      {staff.map((doctor) => (
                        <label key={doctor.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={assigned.includes(doctor.id)}
                            onChange={() => toggleDoctorOnClinic(clinic, doctor.id)}
                          />
                          {doctor.label || `Dr. ${doctor.firstName} ${doctor.lastName}`}
                        </label>
                      ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </Card>
  )
}
