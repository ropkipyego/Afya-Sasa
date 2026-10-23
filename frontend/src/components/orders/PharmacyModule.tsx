import { useEffect, useState } from 'react'
import { PharmacyDashboard } from './PharmacyDashboard'
import { PharmacyPosPanel } from './PharmacyPosPanel'
import { PharmacyUnifiedQueue } from './PharmacyUnifiedQueue'
import { PharmacyProductsStockPanel } from './PharmacyProductsStockPanel'
import type { PharmacyScreen } from './PharmacyNav'
import { DepartmentWorkspaceHeader } from '../layout/DepartmentWorkspaceHeader'
import { WorkspaceTabs } from '../ui/WorkspaceTabs'

export const pharmacyScreenByNav: Record<string, PharmacyScreen> = {
  Dashboard: 'overview',
  'Prescription & OTC Queue': 'dispense-pending',
  'OTC Point of Sale': 'pos',
  'Products & Stock': 'stock',
  // Legacy aliases resolved smoothly:
  Pharmacy: 'overview',
  'Pharmacy Queue': 'dispense-pending',
  'Pharmacy Dispensing': 'dispense-opd',
  'Pharmacy Sales POS': 'pos',
  'Pharmacy Sales': 'pos',
  'Pharmacy Stock': 'stock',
  'Pharmacy Products': 'stock',
}

type Destination = 'overview' | 'queue' | 'pos' | 'stock'

function toDestination(screen: PharmacyScreen): Destination {
  if (screen === 'pos' || screen === 'otc' || screen === 'sales' || screen === 'sales-unpaid') return 'pos'
  if (screen === 'stock' || screen === 'products' || screen === 'expiry' || screen === 'lowstock') return 'stock'
  if (
    screen === 'dispense-pending' ||
    screen === 'dispense-opd' ||
    screen === 'dispense-ipd' ||
    screen === 'dispense-partial' ||
    screen === 'dispense-history'
  ) {
    return 'queue'
  }
  return 'overview'
}

export function PharmacyModule({ initialTab = 'overview' }: { initialTab?: PharmacyScreen }) {
  const [destination, setDestination] = useState<Destination>(() => toDestination(initialTab))
  const [queueMode, setQueueMode] = useState<'opd' | 'ipd' | 'otc'>('opd')

  useEffect(() => {
    setDestination(toDestination(initialTab))
    if (initialTab === 'dispense-ipd') setQueueMode('ipd')
    else if (initialTab === 'dispense-opd' || initialTab === 'dispense-pending') setQueueMode('opd')
  }, [initialTab])

  const openPharmacyConfig = () => {
    window.dispatchEvent(new CustomEvent('afyasasa:navigate', { detail: 'Pharmacy Configuration' }))
  }

  return (
    <div className="workspace-shell animate-fade-in space-y-5">
      <DepartmentWorkspaceHeader
        department="Pharmacy"
        roleHint="Dispense from PHARMACY location only"
        serviceLine="pharmacy"
      />

      <WorkspaceTabs
        active={destination}
        onChange={setDestination}
        tabs={[
          { id: 'overview', label: 'Dashboard' },
          { id: 'queue', label: 'Prescription & OTC Queue' },
          { id: 'pos', label: 'OTC Point of Sale' },
          { id: 'stock', label: 'Products & Stock' },
        ]}
      />

      {destination === 'overview' ? (
        <PharmacyDashboard
          onOpenQueue={(mode) => {
            if (mode) setQueueMode(mode)
            setDestination('queue')
          }}
          onOpenPos={() => setDestination('pos')}
          onOpenStock={() => setDestination('stock')}
          onOpenConfig={openPharmacyConfig}
        />
      ) : null}

      {destination === 'queue' ? (
        <PharmacyUnifiedQueue
          key={queueMode}
          initialMode={queueMode}
          onOpenPos={() => setDestination('pos')}
        />
      ) : null}

      {destination === 'pos' ? <PharmacyPosPanel /> : null}

      {destination === 'stock' ? <PharmacyProductsStockPanel /> : null}
    </div>
  )
}
