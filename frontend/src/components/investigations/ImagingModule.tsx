import { useState } from 'react'
import { FileUp, LayoutDashboard, ScanLine } from 'lucide-react'
import { ImagingDashboard } from './ImagingDashboard'
import { RadiologyWorklist } from './RadiologyWorklist'
import { ImagingResultsEntry } from './ImagingResultsEntry'
import { WorkspaceTabs } from '../ui/WorkspaceTabs'
import { DepartmentWorkspaceHeader } from '../layout/DepartmentWorkspaceHeader'

type ImagingTab = 'overview' | 'worklist' | 'upload'

export function ImagingModule({ initialTab = 'worklist' }: { initialTab?: ImagingTab }) {
  const [tab, setTab] = useState<ImagingTab>(initialTab)
  const [worklistRequestId, setWorklistRequestId] = useState<string | null>(null)

  return (
    <div className="workspace-shell animate-fade-in space-y-5">
      <DepartmentWorkspaceHeader department="Radiology" />
      <WorkspaceTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
          { id: 'worklist', label: 'Worklist', icon: <ScanLine className="h-4 w-4" /> },
          { id: 'upload', label: 'Report entry', icon: <FileUp className="h-4 w-4" /> },
        ]}
      />
      {tab === 'overview' ? (
        <ImagingDashboard
          embedded
          onOpenRequest={(id) => {
            setWorklistRequestId(id)
            setTab('worklist')
          }}
        />
      ) : null}
      {tab === 'worklist' ? <RadiologyWorklist initialRequestId={worklistRequestId} /> : null}
      {tab === 'upload' ? <ImagingResultsEntry /> : null}
    </div>
  )
}
