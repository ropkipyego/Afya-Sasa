import { useState } from 'react'
import {
  AlertTriangle,
  ClipboardCheck,
  LayoutDashboard,
  Package,
  PackagePlus,
  Percent,
  Pill,
  ShoppingBag,
  Timer,
} from 'lucide-react'
import { PharmacyDashboard } from './PharmacyDashboard'
import { PharmacyWorkspace } from './PharmacyWorkspace'
import { PharmacyProductsPanel } from './PharmacyProductsPanel'
import { PharmacyStockStatusPanel } from './PharmacyStockStatusPanel'
import { PharmacyExpiryPanel } from './PharmacyExpiryPanel'
import { PharmacyLowStockPanel } from './PharmacyLowStockPanel'
import { PharmacyReceivePanel } from './PharmacyReceivePanel'
import { PharmacyOtcPanel } from './PharmacyOtcPanel'
import { StockTakeWorkspace } from '../inventory/StockTakeWorkspace'
import { InventoryPricesPanel } from '../inventory/InventoryPricesPanel'
import { DepartmentExportsPanel } from '../reports/DepartmentExportsPanel'
import { DepartmentWorkspaceHeader } from '../layout/DepartmentWorkspaceHeader'
import { WorkspaceTabs } from '../ui/WorkspaceTabs'
import { useAuthStore } from '../../lib/auth-store'

type PharmacyTab =
  | 'overview'
  | 'queue'
  | 'products'
  | 'stock'
  | 'stocktake'
  | 'receive'
  | 'prices'
  | 'expiry'
  | 'lowstock'
  | 'otc'
  | 'reports'

export function PharmacyModule({ initialTab = 'overview' }: { initialTab?: PharmacyTab }) {
  const [tab, setTab] = useState<PharmacyTab>(initialTab)
  const permissions = useAuthStore((state) => state.user?.permissions ?? [])
  const canManageStock = permissions.includes('inventory:manage') || permissions.includes('settings:manage')
  const canPrice = permissions.includes('inventory:manage')
  const canExport = permissions.includes('pharmacy:read')

  return (
    <div className="workspace-shell animate-fade-in space-y-5">
      <DepartmentWorkspaceHeader department="Pharmacy control center" roleHint="Dispense from PHARMACY location only" />
      <WorkspaceTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
          { id: 'queue', label: 'Queue', icon: <Pill className="h-4 w-4" /> },
          { id: 'products', label: 'Products', icon: <Package className="h-4 w-4" /> },
          { id: 'stock', label: 'Stock', icon: <Package className="h-4 w-4" /> },
          { id: 'stocktake', label: 'Stock take', icon: <ClipboardCheck className="h-4 w-4" /> },
          { id: 'receive', label: 'Receive', icon: <PackagePlus className="h-4 w-4" /> },
          { id: 'prices', label: 'Prices', icon: <Percent className="h-4 w-4" /> },
          { id: 'expiry', label: 'Expiry', icon: <Timer className="h-4 w-4" /> },
          { id: 'lowstock', label: 'Low stock', icon: <AlertTriangle className="h-4 w-4" /> },
          { id: 'otc', label: 'OTC', icon: <ShoppingBag className="h-4 w-4" /> },
          { id: 'reports', label: 'Reports', icon: <ClipboardCheck className="h-4 w-4" /> },
        ]}
      />
      {tab === 'overview' ? (
        <PharmacyDashboard
          onOpenDispense={() => setTab('queue')}
          onOpenStockTake={() => setTab('stocktake')}
          onOpenReceive={() => setTab('receive')}
          onOpenProducts={() => setTab('products')}
        />
      ) : null}
      {tab === 'queue' ? <PharmacyWorkspace /> : null}
      {tab === 'products' ? <PharmacyProductsPanel /> : null}
      {tab === 'stock' ? <PharmacyStockStatusPanel /> : null}
      {tab === 'stocktake' ? (
        canManageStock ? (
          <StockTakeWorkspace />
        ) : (
          <p className="text-sm text-slate-600">
            Stock take posting needs inventory:manage. You can still view stock and the dispense queue.
          </p>
        )
      ) : null}
      {tab === 'receive' ? (
        canManageStock ? (
          <PharmacyReceivePanel />
        ) : (
          <p className="text-sm text-slate-600">Receiving stock needs inventory:manage.</p>
        )
      ) : null}
      {tab === 'prices' ? (
        canPrice ? (
          <InventoryPricesPanel />
        ) : (
          <p className="text-sm text-slate-600">Price changes need inventory:manage.</p>
        )
      ) : null}
      {tab === 'expiry' ? <PharmacyExpiryPanel /> : null}
      {tab === 'lowstock' ? <PharmacyLowStockPanel /> : null}
      {tab === 'otc' ? <PharmacyOtcPanel /> : null}
      {tab === 'reports' ? (
        canExport ? (
          <DepartmentExportsPanel initialDataset="pharmacy" />
        ) : (
          <p className="text-sm text-slate-600">No pharmacy export is available for this account.</p>
        )
      ) : null}
    </div>
  )
}
