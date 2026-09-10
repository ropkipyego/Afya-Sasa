import { useState } from 'react'
import { CreditCard, Landmark, ShieldCheck } from 'lucide-react'
import { WorkspaceTabs } from '../ui/WorkspaceTabs'
import { PaymentDesk } from './PaymentDesk'
import { FinanceRevenuePanel } from './FinanceRevenuePanel'
import { FinanceShaPanel } from './FinanceShaPanel'

type FinanceTab = 'cashier' | 'revenue' | 'sha'

export function FinanceModule({ initialTab = 'cashier' }: { initialTab?: FinanceTab }) {
  const [tab, setTab] = useState<FinanceTab>(initialTab)

  return (
    <div className="workspace-shell animate-fade-in space-y-6">
      <WorkspaceTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'cashier', label: 'Cashier', icon: <CreditCard className="h-4 w-4" /> },
          { id: 'revenue', label: 'Revenue', icon: <Landmark className="h-4 w-4" /> },
          { id: 'sha', label: 'SHA', icon: <ShieldCheck className="h-4 w-4" /> },
        ]}
      />
      {tab === 'cashier' ? <PaymentDesk /> : null}
      {tab === 'revenue' ? <FinanceRevenuePanel /> : null}
      {tab === 'sha' ? <FinanceShaPanel /> : null}
    </div>
  )
}
