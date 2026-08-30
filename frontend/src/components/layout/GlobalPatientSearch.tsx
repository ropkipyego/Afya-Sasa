import { useState } from 'react'
import { Search } from 'lucide-react'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'

export function GlobalPatientSearch({
  onSelectPatient,
}: {
  onSelectPatient: (patientId: string) => void
}) {
  const [selected, setSelected] = useState<PatientSearchItem | null>(null)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/90 bg-white/95 px-3 py-3 shadow-[0_-4px_24px_rgba(15,23,42,0.08)] backdrop-blur-md xl:left-72">
      <label className="sr-only" htmlFor="global-patient-search">
        Search patients
      </label>
      <div className="relative mx-auto max-w-3xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <div className="pl-9">
          <PatientSearchAutocomplete
            selected={selected}
            onSelect={(patient) => {
              setSelected(patient)
              if (patient?.id) {
                onSelectPatient(patient.id)
                setSelected(null)
              }
            }}
            placeholder="Search patient — name, phone, MRN…"
            className="[&_input]:min-h-[44px] [&_input]:text-sm"
          />
        </div>
      </div>
    </div>
  )
}
