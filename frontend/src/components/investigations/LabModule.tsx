import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, FileUp, FlaskConical, Inbox, LayoutDashboard } from 'lucide-react'
import { LabDashboard } from './LabDashboard'
import { LabWorklist } from './LabWorklist'
import { LabResultsEntry } from './LabResultsEntry'
import { ResultsInbox } from './ResultsInbox'
import { WorkspaceTabs } from '../ui/WorkspaceTabs'
import { LabHero } from './lab-ui'
import { apiRequest } from '../../lib/api'

type LabTab = 'overview' | 'worklist' | 'results' | 'upload'

async function fetchLabSummary() {
  const [requests, critical] = await Promise.all([
    apiRequest<{ items: { status: string; priority: string }[] } | { status: string; priority: string }[]>(
      '/laboratory/requests?limit=100',
    ).then((res) => (Array.isArray(res) ? res : (res.items ?? []))),
    apiRequest<{ id: string }[]>('/laboratory/results/critical').catch(() => []),
  ])
  const pending = requests.filter((r) => !['verified', 'cancelled'].includes(r.status))
  const urgent = pending.filter((r) => r.priority === 'stat' || r.priority === 'urgent')
  return { pending: pending.length, urgent: urgent.length, critical: critical.length }
}

export function LabModule({ initialTab = 'worklist' }: { initialTab?: LabTab }) {
  const [tab, setTab] = useState<LabTab>(initialTab)
  const { data: summary } = useQuery({
    queryKey: ['lab-module-summary'],
    queryFn: fetchLabSummary,
    refetchInterval: 20_000,
  })

  return (
    <div className="lab-workspace workspace-shell animate-fade-in">
      <LabHero
        title="Laboratory"
        description="Order tests, track specimens through the bench, enter structured results with reference-range flagging, and release verified reports to clinicians."
        stats={[
          { label: 'Open', value: summary?.pending ?? '—' },
          { label: 'Priority', value: summary?.urgent ?? '—', tone: summary?.urgent ? 'bg-amber-500/20' : undefined },
          { label: 'Critical', value: summary?.critical ?? '—', tone: summary?.critical ? 'bg-rose-500/25' : undefined },
        ]}
      />

      {summary?.critical ? (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-white px-5 py-4 text-rose-900 shadow-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
          <p className="text-sm font-semibold">
            {summary.critical} critical result{summary.critical === 1 ? '' : 's'} awaiting clinician review.
          </p>
        </div>
      ) : null}

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

      <div className="lab-tab-panel">
        {tab === 'overview' ? <LabDashboard embedded /> : null}
        {tab === 'worklist' ? <LabWorklist /> : null}
        {tab === 'upload' ? <LabResultsEntry /> : null}
        {tab === 'results' ? <ResultsInbox /> : null}
      </div>
    </div>
  )
}
