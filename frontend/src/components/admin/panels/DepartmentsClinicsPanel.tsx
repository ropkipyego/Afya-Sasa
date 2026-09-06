import { useEffect, useMemo, useState } from 'react'
import { Plus, Save, Stethoscope } from 'lucide-react'
import { Alert, Button, Card, Field, PageHeader } from '../../ui'
import { useHospitalConfiguration } from '../../../hooks/useHospitalConfiguration'
import { useClinicalCatalog } from '../../../hooks/useClinicalCatalog'
import {
  CONFIG_DEPENDENCY_HINTS,
  slugId,
  type StructuredClinic,
  type StructuredDepartment,
} from '../../../lib/hospital-configuration'
import { notify } from '../../../lib/notify'

function seedFromLists(departments: string[], clinics: string[]): {
  departments: StructuredDepartment[]
  clinics: StructuredClinic[]
} {
  const structuredDepartments = departments.map((name) => ({
    id: slugId(name),
    name,
    active: true,
    clinicIds: [] as string[],
  }))
  const structuredClinics = clinics.map((name) => ({
    id: slugId(name),
    name,
    active: true,
    doctorIds: [] as string[],
  }))
  return { departments: structuredDepartments, clinics: structuredClinics }
}

export function DepartmentsClinicsPanel() {
  const { catalog, saveCatalog } = useHospitalConfiguration()
  const { data: liveCatalog } = useClinicalCatalog()
  const staff = liveCatalog?.staffClinicians ?? catalog.staffClinicians ?? []

  const initial = useMemo(() => {
    if (catalog.structuredDepartments?.length || catalog.structuredClinics?.length) {
      return {
        departments: catalog.structuredDepartments ?? [],
        clinics: (catalog.structuredClinics ?? []).map((clinic) => ({
          ...clinic,
          doctorIds: clinic.doctorIds ?? [],
        })),
      }
    }
    return seedFromLists(catalog.departments, catalog.clinics)
  }, [catalog])

  const [departments, setDepartments] = useState<StructuredDepartment[]>(initial.departments)
  const [clinics, setClinics] = useState<StructuredClinic[]>(initial.clinics)
  const [deptName, setDeptName] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [clinicDepartmentId, setClinicDepartmentId] = useState('')
  const [editingClinicId, setEditingClinicId] = useState<string | null>(null)

  useEffect(() => {
    setDepartments(initial.departments)
    setClinics(initial.clinics)
  }, [initial])

  const addDepartment = () => {
    const name = deptName.trim()
    if (!name) return
    const id = slugId(name)
    setDepartments((current) => [...current, { id, name, active: true, clinicIds: [] }])
    setDeptName('')
  }

  const addClinic = () => {
    const name = clinicName.trim()
    if (!name) return
    const id = slugId(name)
    const departmentId = clinicDepartmentId || undefined
    setClinics((current) => [...current, { id, name, departmentId, active: true, doctorIds: [] }])
    if (departmentId) {
      setDepartments((current) =>
        current.map((dept) =>
          dept.id === departmentId
            ? { ...dept, clinicIds: [...new Set([...dept.clinicIds, id])] }
            : dept,
        ),
      )
    }
    setClinicName('')
    setClinicDepartmentId('')
  }

  const toggleDoctorOnClinic = (clinicId: string, doctorId: string) => {
    setClinics((current) =>
      current.map((clinic) => {
        if (clinic.id !== clinicId) return clinic
        const doctorIds = clinic.doctorIds ?? []
        const next = doctorIds.includes(doctorId)
          ? doctorIds.filter((id) => id !== doctorId)
          : [...doctorIds, doctorId]
        return { ...clinic, doctorIds: next }
      }),
    )
  }

  const save = async () => {
    try {
      const syncedClinics = clinics.map((clinic) => {
        const dept = departments.find((d) => d.id === clinic.departmentId)
        return {
          ...clinic,
          departmentId: dept?.id ?? clinic.departmentId,
        }
      })
      const syncedDepartments = departments.map((dept) => ({
        ...dept,
        clinicIds: syncedClinics.filter((c) => c.departmentId === dept.id && c.active).map((c) => c.id),
      }))
      await saveCatalog.mutateAsync({
        structuredDepartments: syncedDepartments,
        structuredClinics: syncedClinics,
      })
      notify(
        'Departments & clinics saved',
        'Clinic group mapping and doctor assignments are now active in OPD and appointments.',
        'success',
      )
    } catch (error) {
      notify('Save failed', (error as Error).message, 'critical')
    }
  }

  return (
    <Card className="p-8">
      <PageHeader
        title="Departments & clinics"
        description="Organize clinical services and assign doctors to each clinic."
      />

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold">Configuration dependency</p>
        <p className="mt-1">
          Departments → {CONFIG_DEPENDENCY_HINTS.departments.join(', ')}. Clinics →{' '}
          {CONFIG_DEPENDENCY_HINTS.clinics.join(', ')}. Assign doctors per clinic so OPD check-in only shows relevant
          clinicians.
        </p>
      </div>

      {!staff.length ? (
        <Alert tone="warning" className="mt-4">
          No clinical staff found. Add doctors in User & access management first — they will appear here for clinic
          assignment.
        </Alert>
      ) : null}

      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <section>
          <h3 className="text-lg font-bold">Departments</h3>
          <div className="mt-4 flex gap-2">
            <Field
              name="newDepartment"
              label="Add department"
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              placeholder="e.g. Internal Medicine"
            />
            <Button type="button" className="mt-7" variant="secondary" onClick={addDepartment}>
              <Plus className="h-4 w-4" />
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
                    {dept.clinicIds.length} clinic(s) · {dept.active ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-xs"
                  onClick={() =>
                    setDepartments((current) =>
                      current.map((d) => (d.id === dept.id ? { ...d, active: !d.active } : d)),
                    )
                  }
                >
                  {dept.active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-lg font-bold">Clinics</h3>
          <div className="mt-4 space-y-3">
            <Field
              name="newClinic"
              label="Clinic name"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="e.g. Diabetes Clinic"
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
            <Button type="button" variant="secondary" onClick={addClinic}>
              <Plus className="h-4 w-4" />
              Add clinic
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {clinics.map((clinic) => {
              const dept = departments.find((d) => d.id === clinic.departmentId)
              const assigned = clinic.doctorIds ?? []
              const isEditing = editingClinicId === clinic.id
              return (
                <div key={clinic.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{clinic.name}</p>
                      <p className="text-xs text-slate-500">
                        {dept ? dept.name : 'No department'} · {assigned.length} doctor(s) ·{' '}
                        {clinic.active ? 'Active' : 'Inactive'}
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
                        onClick={() =>
                          setClinics((current) =>
                            current.map((c) => (c.id === clinic.id ? { ...c, active: !c.active } : c)),
                          )
                        }
                      >
                        {clinic.active ? 'Off' : 'On'}
                      </Button>
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-2">
                      {staff.map((doctor) => (
                        <label key={doctor.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={assigned.includes(doctor.id)}
                            onChange={() => toggleDoctorOnClinic(clinic.id, doctor.id)}
                          />
                          {doctor.label || `Dr. ${doctor.firstName} ${doctor.lastName}`}
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <div className="mt-8">
        <Button type="button" loading={saveCatalog.isPending} onClick={() => void save()}>
          <Save className="h-4 w-4" />
          Save departments & clinics
        </Button>
      </div>
      {saveCatalog.error ? <Alert tone="error">{saveCatalog.error.message}</Alert> : null}
    </Card>
  )
}
