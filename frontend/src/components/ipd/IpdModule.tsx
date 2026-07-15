import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { IpdDashboard } from './IpdDashboard'
import { WardDashboard } from './WardDashboard'
import { PatientWorkspace } from './PatientWorkspace'
import { NursingCommandCenter } from './NursingCommandCenter'
import { IpdAdminSetup } from './IpdAdminSetup'
import { IpdAdmitPanel } from './IpdAdmitPanel'
import { ConsultantRoundDashboard } from './ConsultantRoundDashboard'
import { apiRequest } from '../../lib/api'

type IpdView =
  | { screen: 'dashboard' }
  | { screen: 'ward'; wardId: string }
  | { screen: 'workspace'; admissionId: string; wardId?: string }
  | { screen: 'nursing' }
  | { screen: 'consultant' }
  | { screen: 'setup' }
  | { screen: 'admit' }

type WardSummary = { id: string; type: string }

export function IpdModule({
  initialWardType,
  initialScreen,
}: {
  initialWardType?: 'icu' | 'hdu'
  initialScreen?: 'dashboard' | 'nursing'
} = {}) {
  const [view, setView] = useState<IpdView>({
    screen: initialScreen === 'nursing' ? 'nursing' : 'dashboard',
  })
  const [wardJumpDone, setWardJumpDone] = useState(false)

  const { data: dashboard } = useQuery({
    queryKey: ['ipd-dashboard'],
    queryFn: () =>
      apiRequest<{ wardSummaries: WardSummary[] }>('/inpatient/dashboard'),
    enabled: Boolean(initialWardType) && !wardJumpDone,
  })

  useEffect(() => {
    if (!initialWardType || wardJumpDone || !dashboard?.wardSummaries?.length) return
    const ward = dashboard.wardSummaries.find((w) => w.type === initialWardType)
    if (ward) setView({ screen: 'ward', wardId: ward.id })
    setWardJumpDone(true)
  }, [dashboard, initialWardType, wardJumpDone])

  if (view.screen === 'ward') {
    return (
      <WardDashboard
        wardId={view.wardId}
        onBack={() => setView({ screen: 'dashboard' })}
        onOpenPatient={(admissionId) =>
          setView({ screen: 'workspace', admissionId, wardId: view.wardId })
        }
      />
    )
  }

  if (view.screen === 'workspace') {
    return (
      <PatientWorkspace
        admissionId={view.admissionId}
        onBack={() =>
          view.wardId
            ? setView({ screen: 'ward', wardId: view.wardId })
            : setView({ screen: 'dashboard' })
        }
      />
    )
  }

  if (view.screen === 'consultant') {
    return (
      <ConsultantRoundDashboard
        onBack={() => setView({ screen: 'dashboard' })}
        onOpenPatient={(admissionId) => setView({ screen: 'workspace', admissionId })}
      />
    )
  }

  if (view.screen === 'nursing') {
    return (
      <NursingCommandCenter
        onBack={() => setView({ screen: 'dashboard' })}
        onOpenPatient={(admissionId) => setView({ screen: 'workspace', admissionId })}
      />
    )
  }

  if (view.screen === 'setup') {
    return <IpdAdminSetup onBack={() => setView({ screen: 'dashboard' })} />
  }

  if (view.screen === 'admit') {
    return (
      <div className="workspace-shell animate-fade-in">
        <IpdAdmitPanel
          onAdmitted={(admissionId) => setView({ screen: 'workspace', admissionId })}
        />
        <button
          type="button"
          className="mt-6 text-sm font-semibold text-teal-700 hover:underline"
          onClick={() => setView({ screen: 'dashboard' })}
        >
          ← Back to dashboard
        </button>
      </div>
    )
  }

  return (
    <IpdDashboard
      wardTypeFilter={initialWardType}
      onSelectWard={(wardId) => setView({ screen: 'ward', wardId })}
      onNursing={() => setView({ screen: 'nursing' })}
      onConsultant={() => setView({ screen: 'consultant' })}
      onSetup={() => setView({ screen: 'setup' })}
      onAdmit={() => setView({ screen: 'admit' })}
    />
  )
}
