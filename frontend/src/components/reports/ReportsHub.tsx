import { useState } from 'react'
import { BarChart3, BookOpen, ClipboardList, Download, LayoutDashboard, Stethoscope } from 'lucide-react'
import { ClinicalReportsDashboard } from './ClinicalReportsDashboard'
import { DepartmentExportsPanel } from './DepartmentExportsPanel'
import { ExecutiveAnalyticsDashboard } from './ExecutiveAnalyticsDashboard'
import { OperationsCommandCenter } from '../operations/OperationsCommandCenter'
import { OpdReportsPanel } from './OpdReportsPanel'
import { ReportsCatalogue } from './ReportsCatalogue'
import { WorkspaceTabs } from '../ui/WorkspaceTabs'

type ReportsTab = 'centre' | 'opd' | 'clinical' | 'analytics' | 'operations' | 'exports'

export function ReportsHub({ initialTab = 'centre' }: { initialTab?: ReportsTab }) {
  const [tab, setTab] = useState<ReportsTab>(initialTab)

  return (
    <div className="workspace-shell animate-fade-in">
      <WorkspaceTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'centre', label: 'Reports Centre', icon: <BookOpen className="h-4 w-4" /> },
          { id: 'opd', label: 'OPD', icon: <Stethoscope className="h-4 w-4" /> },
          { id: 'clinical', label: 'Clinical', icon: <ClipboardList className="h-4 w-4" /> },
          { id: 'analytics', label: 'Director', icon: <BarChart3 className="h-4 w-4" /> },
          { id: 'operations', label: 'Operations', icon: <LayoutDashboard className="h-4 w-4" /> },
          { id: 'exports', label: 'Exports', icon: <Download className="h-4 w-4" /> },
        ]}
      />
      {tab === 'centre' ? (
        <ReportsCatalogue
          onOpenAnalytics={() => setTab('analytics')}
          onOpenOperations={() => setTab('operations')}
        />
      ) : null}
      {tab === 'opd' ? <OpdReportsPanel /> : null}
      {tab === 'clinical' ? <ClinicalReportsDashboard /> : null}
      {tab === 'analytics' ? <ExecutiveAnalyticsDashboard /> : null}
      {tab === 'operations' ? <OperationsCommandCenter /> : null}
      {tab === 'exports' ? <DepartmentExportsPanel /> : null}
    </div>
  )
}
