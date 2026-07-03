import { useMemo, useState } from 'react'
import { Plus, Save } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  Field,
  PageHeader,
} from '../../ui'
import { useHospitalConfiguration } from '../../../hooks/useHospitalConfiguration'
import {
  CONFIG_DEPENDENCY_HINTS,
  DEFAULT_MAIN_FACILITY_ID,
  HOSPITAL_MODULES,
  defaultFacilities,
  slugId,
  type FacilitySite,
  type HospitalModuleKey,
} from '../../../lib/hospital-configuration'
import { notify } from '../../../lib/notify'

export function FacilitiesModulesPanel() {
  const { catalog, saveCatalog } = useHospitalConfiguration()
  const [facilities, setFacilities] = useState<FacilitySite[]>(
    () => catalog.facilities?.length ? catalog.facilities : defaultFacilities(catalog.hospitalProfile),
  )

  const mainFacility = useMemo(
    () => facilities.find((f) => f.id === DEFAULT_MAIN_FACILITY_ID) ?? facilities[0],
    [facilities],
  )

  const toggleModule = (facilityId: string, module: HospitalModuleKey, enabled: boolean) => {
    setFacilities((current) =>
      current.map((facility) =>
        facility.id === facilityId
          ? {
              ...facility,
              modules: { ...facility.modules, [module]: enabled },
            }
          : facility,
      ),
    )
  }

  const addSatellite = () => {
    const name = `Satellite Clinic ${facilities.filter((f) => f.type !== 'main').length + 1}`
    setFacilities((current) => [
      ...current,
      {
        id: slugId(name),
        name,
        shortName: name.split(' ')[0],
        type: 'satellite',
        active: true,
        modules: {
          registration: true,
          opd: true,
          laboratory: true,
          documents: true,
          ipd: false,
          theatre: false,
          icu: false,
          maternity: false,
          emergency: false,
          radiology: false,
          pharmacy: false,
          reporting: true,
        },
      },
    ])
  }

  const save = async () => {
    try {
      await saveCatalog.mutateAsync({ facilities })
      notify('Facilities saved', 'Module activation updated across the hospital network.', 'success')
    } catch (error) {
      notify('Save failed', (error as Error).message, 'critical')
    }
  }

  return (
    <Card className="p-8">
      <PageHeader
        title="Facilities & module activation"
        description="One shared patient database — enable only the modules each site needs."
      />

      <div className="mt-6 rounded-xl border border-teal-100 bg-teal-50/60 p-4 text-sm text-teal-900">
        <p className="font-semibold">Configuration dependency</p>
        <p className="mt-1 text-teal-800">
          {CONFIG_DEPENDENCY_HINTS.facilities.join(' · ')}. Patients remain shared across all facilities.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        {facilities.map((facility) => (
          <div key={facility.id} className="rounded-2xl border border-slate-200 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900">{facility.name}</p>
                <p className="text-xs capitalize text-slate-500">
                  {facility.type} · {facility.active ? 'Active' : 'Inactive'}
                </p>
              </div>
              {facility.type === 'main' ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Main hospital
                </span>
              ) : (
                <Field
                  name={`name-${facility.id}`}
                  label="Clinic name"
                  value={facility.name}
                  onChange={(e) =>
                    setFacilities((current) =>
                      current.map((f) =>
                        f.id === facility.id ? { ...f, name: e.target.value } : f,
                      ),
                    )
                  }
                />
              )}
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {HOSPITAL_MODULES.map((module) => {
                const enabled = facility.modules?.[module.key] !== false
                return (
                  <label
                    key={`${facility.id}-${module.key}`}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={enabled}
                      onChange={(e) => toggleModule(facility.id, module.key, e.target.checked)}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">{module.label}</span>
                      <span className="block text-xs text-slate-500">{module.description}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={addSatellite}>
          <Plus className="h-4 w-4" />
          Add satellite clinic
        </Button>
        <Button type="button" loading={saveCatalog.isPending} onClick={() => void save()}>
          <Save className="h-4 w-4" />
          Save facilities
        </Button>
      </div>

      {mainFacility ? (
        <p className="mt-4 text-xs text-slate-500">
          Main site: {mainFacility.name}. Satellite clinics can run a lightweight module set while sharing patients.
        </p>
      ) : null}
      {saveCatalog.error ? <Alert tone="error">{saveCatalog.error.message}</Alert> : null}
    </Card>
  )
}
