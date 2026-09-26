import { useEffect, useState } from 'react'
import { PharmacyDashboard } from './PharmacyDashboard'
import { PharmacyWorkspace, type DispenseFilter } from './PharmacyWorkspace'
import { PharmacyProductsPanel } from './PharmacyProductsPanel'
import { PharmacyStockStatusPanel } from './PharmacyStockStatusPanel'
import { PharmacyExpiryPanel } from './PharmacyExpiryPanel'
import { PharmacyLowStockPanel } from './PharmacyLowStockPanel'
import { PharmacyReceivePanel } from './PharmacyReceivePanel'
import { PharmacyOtcPanel } from './PharmacyOtcPanel'
import { PharmacySalesPanel } from './PharmacySalesPanel'
import type { PharmacyScreen } from './PharmacyNav'
import { StockTakeWorkspace } from '../inventory/StockTakeWorkspace'
import { InventoryPricesPanel } from '../inventory/InventoryPricesPanel'
import { DepartmentExportsPanel } from '../reports/DepartmentExportsPanel'
import { DepartmentWorkspaceHeader } from '../layout/DepartmentWorkspaceHeader'
import { WorkspaceTabs } from '../ui/WorkspaceTabs'
import { useAuthStore } from '../../lib/auth-store'

export const pharmacyScreenByNav: Record<string, PharmacyScreen> = {
  Pharmacy: 'overview',
  'Pharmacy Queue': 'dispense-pending',
  'Pharmacy Dispensing': 'dispense-opd',
  'Pharmacy Sales': 'sales',
  'Pharmacy Stock': 'stock',
  'Pharmacy Stock Take': 'stocktake',
  'Pharmacy Products': 'products',
  'Pharmacy Reports': 'reports',
}

function Unavailable({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
      <p className="font-semibold">{title}</p>
      <p className="mt-2">{detail}</p>
    </div>
  )
}

export function PharmacyModule({ initialTab = 'overview' }: { initialTab?: PharmacyScreen }) {
  const [screen, setScreen] = useState<PharmacyScreen>(initialTab)
  const permissions = useAuthStore((state) => state.user?.permissions ?? [])
  const canManageStock = permissions.includes('inventory:manage') || permissions.includes('settings:manage')
  const canPrice = permissions.includes('inventory:manage')
  const canExport = permissions.includes('pharmacy:read')

  useEffect(() => {
    setScreen(initialTab)
  }, [initialTab])

  const dispenseFilter = ((): DispenseFilter | null => {
    if (screen === 'dispense-opd') return 'opd'
    if (screen === 'dispense-ipd') return 'ipd'
    if (screen === 'dispense-pending') return 'pending'
    if (screen === 'dispense-partial') return 'partial'
    if (screen === 'dispense-history') return 'history'
    return null
  })()

  return (
    <div className="workspace-shell animate-fade-in space-y-5">
      <DepartmentWorkspaceHeader department="Pharmacy" roleHint="Dispense from PHARMACY location only" />

      {screen === 'overview' ? (
        <PharmacyDashboard
          onOpenDispense={() => setScreen('dispense-pending')}
          onOpenStockTake={() => setScreen('stocktake')}
          onOpenReceive={() => setScreen('receive')}
          onOpenProducts={() => setScreen('products')}
          onOpenSales={() => setScreen('sales')}
        />
      ) : null}

      {dispenseFilter ? (
        <div className="space-y-4">
          <WorkspaceTabs
            active={screen}
            onChange={setScreen}
            tabs={[
              { id: 'dispense-pending', label: 'Pending' },
              { id: 'dispense-opd', label: 'OPD' },
              { id: 'dispense-ipd', label: 'IPD' },
              { id: 'dispense-partial', label: 'Partial' },
              { id: 'dispense-history', label: 'History' },
            ]}
          />
          <PharmacyWorkspace filter={dispenseFilter} />
        </div>
      ) : null}

      {screen === 'sales' || screen === 'sales-payments' || screen === 'sales-unpaid' || screen === 'otc' ? (
        <div className="space-y-4">
          <WorkspaceTabs
            active={screen === 'sales-unpaid' ? 'sales-unpaid' : screen === 'otc' ? 'otc' : 'sales'}
            onChange={setScreen}
            tabs={[
              { id: 'sales', label: 'Collections' },
              { id: 'sales-unpaid', label: 'Unpaid / pending' },
              { id: 'otc', label: 'OTC' },
            ]}
          />
          {screen === 'otc' ? <PharmacyOtcPanel /> : <PharmacySalesPanel mode={screen === 'sales-unpaid' ? 'unpaid' : 'all'} />}
        </div>
      ) : null}

      {screen === 'products' || screen === 'categories' || screen === 'prices' ? (
        <div className="space-y-4">
          <WorkspaceTabs
            active={screen === 'prices' ? 'prices' : 'products'}
            onChange={setScreen}
            tabs={[
              { id: 'products', label: 'Products' },
              { id: 'prices', label: 'Prices' },
            ]}
          />
          {screen === 'prices' ? (
            canPrice ? <InventoryPricesPanel /> : <p className="text-sm text-slate-600">Price changes need inventory:manage.</p>
          ) : (
            <PharmacyProductsPanel />
          )}
        </div>
      ) : null}

      {screen === 'stock' || screen === 'receive' || screen === 'expiry' || screen === 'lowstock' ? (
        <div className="space-y-4">
          <WorkspaceTabs
            active={screen}
            onChange={setScreen}
            tabs={[
              { id: 'stock', label: 'Overview' },
              { id: 'receive', label: 'Receive' },
              { id: 'expiry', label: 'Expiry' },
              { id: 'lowstock', label: 'Low stock' },
            ]}
          />
          {screen === 'stock' ? <PharmacyStockStatusPanel /> : null}
          {screen === 'receive' ? (
            canManageStock ? <PharmacyReceivePanel /> : <p className="text-sm text-slate-600">Receiving needs inventory:manage.</p>
          ) : null}
          {screen === 'expiry' ? <PharmacyExpiryPanel /> : null}
          {screen === 'lowstock' ? <PharmacyLowStockPanel /> : null}
        </div>
      ) : null}

      {screen === 'stocktake' || screen === 'import' ? (
        canManageStock ? (
          <StockTakeWorkspace />
        ) : (
          <p className="text-sm text-slate-600">Stock take posting needs inventory:manage. You can still open the queue from Queue Management.</p>
        )
      ) : null}

      {screen === 'reports' ? (
        canExport ? (
          <DepartmentExportsPanel initialDataset="pharmacy" />
        ) : (
          <p className="text-sm text-slate-600">No pharmacy export is available for this account.</p>
        )
      ) : null}

      {screen === 'transfers' ? (
        <Unavailable
          title="Transfers stay on Inventory & Store"
          detail="Use Inventory & Store → Transfers. Pharmacy does not have a second transfer engine."
        />
      ) : null}
      {screen === 'adjustments' || screen === 'returns' ? (
        <Unavailable
          title={screen === 'returns' ? 'Returns are not in the live backend' : 'Adjustments are not in the live backend'}
          detail="Use Stock take after a physical count. Do not invent a second inventory ledger."
        />
      ) : null}
    </div>
  )
}
