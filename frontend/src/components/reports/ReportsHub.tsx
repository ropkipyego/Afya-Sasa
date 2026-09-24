import { useState } from 'react'
import { BarChart3, ClipboardList, Download, LayoutDashboard, Stethoscope } from 'lucide-react'
import { ClinicalReportsDashboard } from './ClinicalReportsDashboard'
import { DepartmentExportsPanel } from './DepartmentExportsPanel'
import { ExecutiveAnalyticsDashboard } from './ExecutiveAnalyticsDashboard'
import { OperationsCommandCenter } from '../operations/OperationsCommandCenter'
import { OpdReportsPanel } from './OpdReportsPanel'
import { WorkspaceTabs } from '../ui/WorkspaceTabs'

type ReportsTab = 'opd' | 'clinical' | 'analytics' | 'operations' | 'exports'

export function ReportsHub({ initialTab = 'opd' }: { initialTab?: ReportsTab }) {
  const [tab, setTab] = useState<ReportsTab>(initialTab)

  return (
    <div className="workspace-shell animate-fade-in">
      <WorkspaceTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'opd', label: 'OPD', icon: <Stethoscope className="h-4 w-4" /> },
          { id: 'clinical', label: 'Clinical', icon: <ClipboardList className="h-4 w-4" /> },
          { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
          { id: 'operations', label: 'Operations', icon: <LayoutDashboard className="h-4 w-4" /> },
          { id: 'exports', label: 'Exports', icon: <Download className="h-4 w-4" /> },
        ]}
      />
      {tab === 'opd' ? <OpdReportsPanel /> : null}
      {tab === 'clinical' ? <ClinicalReportsDashboard /> : null}
      {tab === 'analytics' ? <ExecutiveAnalyticsDashboard /> : null}
      {tab === 'operations' ? <OperationsCommandCenter /> : null}
      {tab === 'exports' ? <DepartmentExportsPanel /> : null}
    </div>
  )
}
