import { useState } from 'react'
import { FlaskConical, FileUp, Inbox, LayoutDashboard } from 'lucide-react'
import { LabDashboard } from './LabDashboard'
import { LabWorklist } from './LabWorklist'
import { LabResultsEntry } from './LabResultsEntry'
import { ResultsInbox } from './ResultsInbox'
import { WorkspaceTabs } from '../ui/WorkspaceTabs'

type LabTab = 'overview' | 'worklist' | 'results' | 'upload'

export function LabModule({ initialTab = 'worklist' }: { initialTab?: LabTab }) {
  const [tab, setTab] = useState<LabTab>(initialTab)

  return (
    <div className="workspace-shell animate-fade-in">
      <WorkspaceTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
          { id: 'worklist', label: 'Worklist', icon: <FlaskConical className="h-4 w-4" /> },
          { id: 'upload', label: 'Result entry', icon: <FileUp className="h-4 w-4" /> },
          { id: 'results', label: 'Results inbox', icon: <Inbox className="h-4 w-4" /> },
        ]}
      />
      {tab === 'overview' ? <LabDashboard embedded /> : null}
      {tab === 'worklist' ? <LabWorklist /> : null}
      {tab === 'upload' ? <LabResultsEntry /> : null}
      {tab === 'results' ? <ResultsInbox /> : null}
    </div>
  )
}
