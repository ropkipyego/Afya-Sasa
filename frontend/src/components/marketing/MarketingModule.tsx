import { useState, type ReactNode } from 'react'
import { CalendarClock, LayoutDashboard, MapPinned, Upload, Users } from 'lucide-react'
import { WorkspaceTabs } from '../ui/WorkspaceTabs'
import { useAuthStore } from '../../lib/auth-store'
import { MarketingDashboard } from './MarketingDashboard'
import { MarketingFollowUps } from './MarketingFollowUps'
import { MarketingDailyReport } from './MarketingDailyReport'
import { MarketingTeamReport } from './MarketingTeamReport'
import { ServiceCatalogsHub } from '../catalog/ServiceCatalogsHub'

type MarketingTab = 'overview' | 'daily' | 'team' | 'followups' | 'catalogs'

export function MarketingModule({ initialTab = 'overview' }: { initialTab?: MarketingTab }) {
  const permissions = useAuthStore((state) => state.user?.permissions ?? [])
  const canSeeTeam =
    permissions.includes('marketing:manage') || permissions.includes('marketing:reports')
  const [tab, setTab] = useState<MarketingTab>(initialTab)
  const tabs: { id: MarketingTab; label: string; icon: ReactNode }[] = [
    { id: 'overview', label: 'My dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'daily', label: 'Daily report', icon: <MapPinned className="h-4 w-4" /> },
    ...(canSeeTeam
      ? [{ id: 'team' as const, label: 'Team report', icon: <Users className="h-4 w-4" /> }]
      : []),
    { id: 'followups', label: 'Clinic follow-ups', icon: <CalendarClock className="h-4 w-4" /> },
    { id: 'catalogs', label: 'Catalogs', icon: <Upload className="h-4 w-4" /> },
  ]

  return (
    <div className="workspace-shell animate-fade-in">
      <WorkspaceTabs
        active={tab}
        onChange={setTab}
        tabs={tabs}
      />
      {tab === 'overview' ? <MarketingDashboard onOpenDaily={() => setTab('daily')} /> : null}
      {tab === 'daily' ? <MarketingDailyReport /> : null}
      {tab === 'team' && canSeeTeam ? <MarketingTeamReport /> : null}
      {tab === 'followups' ? <MarketingFollowUps /> : null}
      {tab === 'catalogs' ? <ServiceCatalogsHub /> : null}
    </div>
  )
}
