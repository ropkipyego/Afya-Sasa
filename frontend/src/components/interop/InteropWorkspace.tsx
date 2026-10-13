import { useQuery } from '@tanstack/react-query'
import { Card, PageHeader, Alert } from '../ui'
import { apiRequest, formatApiError } from '../../lib/api'

type FhirStatus = {
  fhirVersion: string
  kenyaCoreIg: { url: string; version: string }
  eClaimsIg: { url: string; status: string }
  connection: {
    state: string
    sandboxEnabled: boolean
    credentialsReady: boolean
    connected: boolean
    note: string
  }
  coverage: {
    kenyaCore: Array<{ element: string; source: string; missing: boolean; note: string }>
    eClaimsDraft: Array<{ element: string; source: string; missing: boolean; note: string }>
  }
}

type SyntheticResult = {
  sandboxConnected: boolean
  validFixture: { valid: boolean; issues: Array<{ path: string; message: string }> }
  missingRequired: { valid: boolean; issues: Array<{ path: string; message: string }> }
}

export function InteropWorkspace() {
  const status = useQuery({
    queryKey: ['fhir-status'],
    queryFn: () => apiRequest<FhirStatus>('/integrations/fhir/status'),
  })
  const synthetic = useQuery({
    queryKey: ['fhir-synthetic'],
    queryFn: () => apiRequest<SyntheticResult>('/integrations/fhir/validate-synthetic'),
  })

  return (
    <div className="workspace-shell animate-fade-in space-y-6">
      <Card className="p-6">
        <PageHeader
          title="Interoperability / FHIR"
          description="Kenya Core mappings from existing AfyaSasa records. This screen never claims HIE connectivity without a successful authorized test."
        />
      </Card>

      {status.error ? (
        <Alert tone="error">{formatApiError(status.error, 'Unable to load FHIR status.')}</Alert>
      ) : null}

      {status.data ? (
        <Card className="space-y-3 p-6">
          <h3 className="text-sm font-bold text-slate-800">Standards</h3>
          <p className="text-sm text-slate-600">
            FHIR {status.data.fhirVersion} · Kenya Core IG {status.data.kenyaCoreIg.version} (
            <a className="underline" href={status.data.kenyaCoreIg.url} target="_blank" rel="noreferrer">
              published
            </a>
            ) · eClaims IG {status.data.eClaimsIg.status} (
            <a className="underline" href={status.data.eClaimsIg.url} target="_blank" rel="noreferrer">
              draft
            </a>
            )
          </p>
          <Alert tone={status.data.connection.connected ? 'success' : 'warning'}>
            Connection: {status.data.connection.state}. Sandbox connected:{' '}
            {status.data.connection.connected ? 'yes' : 'no'}. {status.data.connection.note}
          </Alert>
        </Card>
      ) : null}

      {synthetic.data ? (
        <Card className="space-y-3 p-6">
          <h3 className="text-sm font-bold text-slate-800">Synthetic validation</h3>
          <p className="text-sm text-slate-600">
            Valid fixture: {synthetic.data.validFixture.valid ? 'pass' : 'fail'}. Missing-required fixture:{' '}
            {synthetic.data.missingRequired.valid ? 'unexpected pass' : 'correctly failed'}.
          </p>
          {!synthetic.data.missingRequired.valid ? (
            <ul className="list-disc pl-5 text-sm text-slate-600">
              {synthetic.data.missingRequired.issues.map((issue) => (
                <li key={issue.path}>
                  {issue.path}: {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {status.data ? (
        <Card className="space-y-3 p-6">
          <h3 className="text-sm font-bold text-slate-800">eClaims gap matrix (draft IG)</h3>
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Element</th>
                <th>Source</th>
                <th>Gap</th>
              </tr>
            </thead>
            <tbody>
              {status.data.coverage.eClaimsDraft.map((row) => (
                <tr key={row.element} className="border-t border-slate-100">
                  <td className="py-2 font-medium">{row.element}</td>
                  <td>{row.source}</td>
                  <td>{row.missing ? row.note : 'Mapped'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  )
}
