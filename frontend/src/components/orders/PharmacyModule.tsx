import { useState } from 'react'
import { LayoutDashboard, Package, Pill, ShoppingBag } from 'lucide-react'
import { PharmacyDashboard } from './PharmacyDashboard'
import { PharmacyWorkspace } from './PharmacyWorkspace'
import { PharmacyStockPanel } from './PharmacyStockPanel'
import { PharmacyOtcPanel } from './PharmacyOtcPanel'
import { WorkspaceTabs } from '../ui/WorkspaceTabs'

type PharmacyTab = 'overview' | 'dispense' | 'stock' | 'otc'

export function PharmacyModule({ initialTab = 'overview' }: { initialTab?: PharmacyTab }) {
  const [tab, setTab] = useState<PharmacyTab>(initialTab)

  return (
    <div className="workspace-shell animate-fade-in">
      <WorkspaceTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
          { id: 'dispense', label: 'Dispense', icon: <Pill className="h-4 w-4" /> },
          { id: 'stock', label: 'Pharmacy stock', icon: <Package className="h-4 w-4" /> },
          { id: 'otc', label: 'OTC sales', icon: <ShoppingBag className="h-4 w-4" /> },
        ]}
      />
      {tab === 'overview' ? <PharmacyDashboard onOpenDispense={() => setTab('dispense')} /> : null}
      {tab === 'dispense' ? <PharmacyWorkspace /> : null}
      {tab === 'stock' ? <PharmacyStockPanel /> : null}
      {tab === 'otc' ? <PharmacyOtcPanel /> : null}
    </div>
  )
}
