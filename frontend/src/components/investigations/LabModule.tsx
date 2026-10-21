import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Droplets, FileUp, FlaskConical, Inbox, LayoutDashboard, UserRound } from 'lucide-react'
import { LabDashboard } from './LabDashboard'
import { LabWorklist } from './LabWorklist'
import { LabWalkInDesk } from './LabWalkInDesk'
import { LabResultsEntry } from './LabResultsEntry'
import { ResultsInbox } from './ResultsInbox'
import { WorkspaceTabs } from '../ui/WorkspaceTabs'
import { LabHero } from './lab-ui'
import { DepartmentWorkspaceHeader } from '../layout/DepartmentWorkspaceHeader'
import { apiRequest } from '../../lib/api'
import { DiagnosticCheckInArrivals } from './DiagnosticCheckInArrivals'
import { BloodBankDesk } from './BloodBankDesk'

type LabTab = 'overview' | 'walkin' | 'worklist' | 'results' | 'upload' | 'bloodbank'

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
  const [worklistRequestId, setWorklistRequestId] = useState<string | null>(null)
  const { data: summary } = useQuery({
    queryKey: ['lab-module-summary'],
    queryFn: fetchLabSummary,
    refetchInterval: 20_000,
  })

  return (
    <div className="lab-workspace workspace-shell animate-fade-in">
      <DepartmentWorkspaceHeader department="Laboratory" serviceLine="laboratory" />
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
          { id: 'walkin', label: 'Walk-in desk', icon: <UserRound className="h-4 w-4" /> },
          { id: 'worklist', label: 'Worklist', icon: <FlaskConical className="h-4 w-4" /> },
          { id: 'upload', label: 'Result entry', icon: <FileUp className="h-4 w-4" /> },
          { id: 'results', label: 'Results inbox', icon: <Inbox className="h-4 w-4" /> },
          { id: 'bloodbank', label: 'Blood bank', icon: <Droplets className="h-4 w-4" /> },
        ]}
      />

      <div className="lab-tab-panel">
        {tab === 'overview' ? (
          <div className="space-y-4">
            <DiagnosticCheckInArrivals queueType="LAB" title="Reception check-ins for laboratory" />
            <LabTemplateGaps />
            <LabDashboard
              embedded
              onOpenRequest={(id) => {
                setWorklistRequestId(id)
                setTab('worklist')
              }}
            />
          </div>
        ) : null}
        {tab === 'walkin' ? <LabWalkInDesk /> : null}
        {tab === 'worklist' ? (
          <div className="space-y-4">
            <DiagnosticCheckInArrivals queueType="LAB" title="Reception check-ins for laboratory" />
            <LabWorklist initialRequestId={worklistRequestId} />
          </div>
        ) : null}
        {tab === 'upload' ? <LabResultsEntry /> : null}
        {tab === 'results' ? <ResultsInbox /> : null}
        {tab === 'bloodbank' ? <BloodBankDesk /> : null}
      </div>
    </div>
  )
}

function LabTemplateGaps() {
  const { data = [] } = useQuery({
    queryKey: ['lab-catalog-gaps'],
    queryFn: () =>
      apiRequest<
        Array<{ testCode: string; testName: string; parameterCode: string; parameterName: string; unit?: string | null }>
      >('/laboratory/catalog/gaps').catch(() => []),
  })
  if (!data.length) return null
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-950">Catalogue gaps for laboratory review</p>
      <p className="mt-1 text-xs text-amber-900">
        These analytes have no reference interval in the hospital catalogue. Missing values are not filled with
        invented normals.
      </p>
      <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-amber-950">
        {data.slice(0, 20).map((row) => (
          <li key={`${row.testCode}-${row.parameterCode}`}>
            {row.testName} · {row.parameterName}
            {row.unit ? ` (${row.unit})` : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}
