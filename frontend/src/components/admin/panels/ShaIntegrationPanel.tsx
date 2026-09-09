import { useQuery } from '@tanstack/react-query'
import { ExternalLink, ShieldCheck } from 'lucide-react'
import { Alert, Card, PageHeader } from '../../ui'
import { getShaStatus } from '../../../lib/sha'
import { ShaEligibilityCard } from '../../sha/ShaEligibilityCard'

export function ShaIntegrationPanel() {
  const { data: status, isLoading } = useQuery({
    queryKey: ['sha-status'],
    queryFn: getShaStatus,
  })

  return (
    <Card className="space-y-6 p-8">
      <PageHeader
        title="SHA / Social Health Authority"
        description="Follow sha.go.ke and the DHA HIE: identify the patient, check eligibility, then consent, then claim. AfyaSasa does not invent SHA cover."
      />

      {isLoading ? <p className="text-sm text-slate-500">Loading SHA connection status…</p> : null}

      {status ? (
        <Alert tone={status.connected ? 'success' : status.mode === 'stub' ? 'warning' : 'info'}>
          {status.connected
            ? 'Live SHA HIE credentials are configured. Eligibility checks go to the national network.'
            : status.mode === 'stub'
              ? 'Practice mode. Staff can learn the four official outcomes, but this is not SHA.'
              : 'Not connected. Reception can still register patients. Use portal.sha.go.ke until DHA issues this facility a client ID, secret, and FR code.'}
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <OfficialLink href="https://sha.go.ke" label="sha.go.ke — public SHA site" />
        <OfficialLink href="https://portal.sha.go.ke" label="Provider portal" />
        <OfficialLink
          href="https://hie-docs.dha.go.ke/docs/claims/process/eligibility/eligibilityCheck"
          label="HIE eligibility guide"
        />
      </div>

      <section>
        <h3 className="font-semibold">Three SHA funds (from sha.go.ke)</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {(status?.funds ?? []).map((fund) => (
            <div key={fund.code} className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase text-teal-700">{fund.code}</p>
              <p className="mt-1 font-semibold">{fund.name}</p>
              <ul className="mt-2 list-disc pl-4 text-sm text-slate-600">
                {fund.covers.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-semibold">Official hospital sequence</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          {(status?.nextOfficialSteps ?? []).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-slate-500">
          SHA accepts National ID, Client Registry ID, birth notification/certificate, Alien ID, Refugee ID, or
          Mandate Number — not a passport. Prefer Client Registry ID once it is known.
        </p>
      </section>

      <ShaEligibilityCard />

      <p className="flex items-center gap-2 text-xs text-slate-500">
        <ShieldCheck className="h-4 w-4" />
        Facility FR code {status?.facilityFrCodeSet ? 'is set' : 'is missing'}. Credentials{' '}
        {status?.credentialsSet ? 'are set' : 'are missing'}.
      </p>
    </Card>
  )
}

function OfficialLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-teal-800 hover:bg-slate-50"
    >
      <ExternalLink className="h-4 w-4" />
      {label}
    </a>
  )
}
