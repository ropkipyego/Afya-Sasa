import { useState } from 'react'
import clsx from 'clsx'
import { MaternityDashboard } from './MaternityDashboard'
import { AncClinicWorkspace } from './AncClinicWorkspace'
import { LabourWardWorkspace } from './LabourWardWorkspace'
import { MotherBabyRegistry } from './MotherBabyRegistry'
import { MaternityUnitBoard } from './MaternityUnitBoard'
import { BirthRegister } from './BirthRegister'
import { PageHeader } from '../ui'

const screens = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'anc', label: 'ANC Clinic' },
  { id: 'labour', label: 'Labour Ward' },
  { id: 'deliveries', label: 'Deliveries' },
  { id: 'postnatal', label: 'Postnatal Ward' },
  { id: 'nursery', label: 'Nursery' },
  { id: 'nicu', label: 'NICU' },
  { id: 'registry', label: 'Mother-Baby Registry' },
  { id: 'birth-register', label: 'Birth Register' },
] as const

type ScreenId = (typeof screens)[number]['id']

export function MaternityServiceLine() {
  const [screen, setScreen] = useState<ScreenId>('dashboard')

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Maternity Service Line"
        description="ANC · labour · delivery · postnatal · nursery · NICU — separate from general IPD"
      />

      <div className="flex flex-wrap gap-2 rounded-2xl border border-pink-200 bg-white p-2 shadow-sm">
        {screens.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setScreen(item.id)}
            className={clsx(
              'rounded-xl px-4 py-2 text-sm font-semibold transition',
              screen === item.id ? 'bg-pink-600 text-white shadow-sm' : 'text-slate-600 hover:bg-pink-50',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {screen === 'dashboard' ? <MaternityDashboard /> : null}
      {screen === 'anc' ? <AncClinicWorkspace /> : null}
      {screen === 'labour' || screen === 'deliveries' ? <LabourWardWorkspace mode={screen} /> : null}
      {screen === 'postnatal' ? <MaternityUnitBoard unit="postnatal" title="Postnatal Ward" /> : null}
      {screen === 'nursery' ? <MaternityUnitBoard unit="nursery" title="Nursery" /> : null}
      {screen === 'nicu' ? <MaternityUnitBoard unit="nicu" title="NICU" /> : null}
      {screen === 'registry' ? <MotherBabyRegistry /> : null}
      {screen === 'birth-register' ? <BirthRegister /> : null}
    </div>
  )
}
