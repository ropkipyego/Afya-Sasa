import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, PageHeader } from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { PatientContextHeader } from '../PatientContextHeader'
import { ShaEligibilityCard } from '../sha/ShaEligibilityCard'
import { getShaStatus } from '../../lib/sha'

export function FinanceShaPanel() {
  const [patient, setPatient] = useState<PatientSearchItem | null>(null)
  const { data: status } = useQuery({
    queryKey: ['sha-status'],
    queryFn: getShaStatus,
    staleTime: 60_000,
  })

  return (
    <div className="space-y-6">
      <Card className="p-5 md:p-8">
        <PageHeader
          title="SHA & insurance"
          description="Check coverage here. Submit and follow claims on the official SHA portal until a claims pack is approved in AfyaSasa."
        />
        <div className="mt-6 space-y-4 text-sm text-slate-600">
          <p>
            Mode:{' '}
            <strong className="text-slate-900">{status?.mode ?? '…'}</strong>
            {status?.connected ? ' · HIE reachable' : ' · HIE not connected'}
          </p>
          <p>
            Claims are not typed as cash on the cashier. Use{' '}
            <a
              className="font-semibold text-teal-800 underline"
              href={status?.providerPortal ?? 'https://portal.sha.go.ke'}
              target="_blank"
              rel="noreferrer"
            >
              portal.sha.go.ke
            </a>{' '}
            for claim submit and discharge.
          </p>
        </div>
      </Card>

      <Card className="p-5 md:p-8">
        <PatientSearchAutocomplete selected={patient} onSelect={setPatient} />
        {patient ? (
          <div className="mt-6 space-y-4">
            <PatientContextHeader patient={patient} workflowStep="checked_in" />
            <ShaEligibilityCard patientId={patient.id} />
          </div>
        ) : (
          <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            Search a patient to run the official eligibility check. Private insurance schemes stay on
            the cashier as method = insurance until a claims register is built.
          </p>
        )}
      </Card>
    </div>
  )
}
