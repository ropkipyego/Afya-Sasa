import { useState } from 'react'
import { CalendarClock, LayoutDashboard, MapPinned, Upload } from 'lucide-react'
import { WorkspaceTabs } from '../ui/WorkspaceTabs'
import { MarketingDashboard } from './MarketingDashboard'
import { MarketingFollowUps } from './MarketingFollowUps'
import { MarketingDailyReport } from './MarketingDailyReport'
import { ServiceCatalogsHub } from '../catalog/ServiceCatalogsHub'

type MarketingTab = 'overview' | 'followups' | 'daily' | 'catalogs'

export function MarketingModule({ initialTab = 'overview' }: { initialTab?: MarketingTab }) {
  const [tab, setTab] = useState<MarketingTab>(initialTab)

  return (
    <div className="workspace-shell animate-fade-in">
      <WorkspaceTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
          { id: 'followups', label: 'Follow-ups', icon: <CalendarClock className="h-4 w-4" /> },
          { id: 'daily', label: 'Daily report', icon: <MapPinned className="h-4 w-4" /> },
          { id: 'catalogs', label: 'Catalogs', icon: <Upload className="h-4 w-4" /> },
        ]}
      />
      {tab === 'overview' ? <MarketingDashboard onOpenFollowUps={() => setTab('followups')} /> : null}
      {tab === 'followups' ? <MarketingFollowUps /> : null}
      {tab === 'daily' ? <MarketingDailyReport /> : null}
      {tab === 'catalogs' ? <ServiceCatalogsHub /> : null}
    </div>
  )
}
