import { useEffect, useMemo, useState } from 'react'
import { Plus, Save } from 'lucide-react'
import { Alert, Button, Card, Field, PageHeader } from '../../ui'
import { useHospitalConfiguration } from '../../../hooks/useHospitalConfiguration'
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
  }))
  return { departments: structuredDepartments, clinics: structuredClinics }
}

export function DepartmentsClinicsPanel() {
  const { catalog, saveCatalog } = useHospitalConfiguration()
  const initial = useMemo(() => {
    if (catalog.structuredDepartments?.length || catalog.structuredClinics?.length) {
      return {
        departments: catalog.structuredDepartments ?? [],
        clinics: catalog.structuredClinics ?? [],
      }
    }
    return seedFromLists(catalog.departments, catalog.clinics)
  }, [catalog])

  const [departments, setDepartments] = useState<StructuredDepartment[]>(initial.departments)
  const [clinics, setClinics] = useState<StructuredClinic[]>(initial.clinics)
  const [deptName, setDeptName] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [clinicDepartmentId, setClinicDepartmentId] = useState('')

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
    setClinics((current) => [...current, { id, name, departmentId, active: true }])
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

  const save = async () => {
    try {
      await saveCatalog.mutateAsync({ structuredDepartments: departments, structuredClinics: clinics })
      notify(
        'Departments & clinics saved',
        'Lists are now available in OPD, appointments, and reporting.',
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
        description="Organize clinical services — changes propagate to workflows immediately."
      />

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold">Configuration dependency</p>
        <p className="mt-1">
          Departments → {CONFIG_DEPENDENCY_HINTS.departments.join(', ')}. Clinics →{' '}
          {CONFIG_DEPENDENCY_HINTS.clinics.join(', ')}.
        </p>
      </div>

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
          <div className="mt-4 space-y-2">
            {clinics.map((clinic) => {
              const dept = departments.find((d) => d.id === clinic.departmentId)
              return (
                <div
                  key={clinic.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
                >
                  <div>
                    <p className="font-semibold">{clinic.name}</p>
                    <p className="text-xs text-slate-500">
                      {dept ? dept.name : 'No department'} · {clinic.active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
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
                    {clinic.active ? 'Deactivate' : 'Activate'}
                  </Button>
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
