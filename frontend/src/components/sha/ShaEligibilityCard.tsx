import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { Alert, Button, Field, SelectField } from '../ui'
import {
  SHA_IDENTIFICATION_TYPES,
  checkShaEligibility,
  getLatestShaEligibility,
  getShaStatus,
  type ShaEligibilityCheck,
} from '../../lib/sha'
import { notify } from '../../lib/notify'

export function ShaEligibilityCard({
  patientId,
  defaultType = 'National ID',
  defaultNumber = '',
}: {
  patientId?: string
  defaultType?: string
  defaultNumber?: string
}) {
  const queryClient = useQueryClient()
  const [identificationType, setIdentificationType] = useState(defaultType)
  const [identificationNumber, setIdentificationNumber] = useState(defaultNumber)
  const [result, setResult] = useState<ShaEligibilityCheck | null>(null)

  const { data: status } = useQuery({
    queryKey: ['sha-status'],
    queryFn: getShaStatus,
    staleTime: 60_000,
  })
  const { data: latest } = useQuery({
    queryKey: ['sha-eligibility', patientId],
    queryFn: () => getLatestShaEligibility(patientId!),
    enabled: Boolean(patientId),
  })

  const check = useMutation({
    mutationFn: () =>
      checkShaEligibility({
        patientId,
        identificationType: identificationNumber.trim() ? identificationType : undefined,
        identificationNumber: identificationNumber.trim() || undefined,
      }),
    onSuccess: async (data) => {
      setResult(data)
      if (patientId) {
        await queryClient.invalidateQueries({ queryKey: ['sha-eligibility', patientId] })
        await queryClient.invalidateQueries({ queryKey: ['patient', patientId] })
      }
      notify(
        data.outcome === 'eligible' ? 'SHA coverage active' : 'SHA check complete',
        data.statusDesc || data.outcome.replace('_', ' '),
        data.outcome === 'eligible' ? 'success' : data.outcome === 'not_found' ? 'warning' : 'info',
      )
    },
    onError: (error: Error) => notify('SHA check failed', error.message, 'critical'),
  })

  const shown = result ?? latest ?? null

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-teal-700" />
        <div>
          <p className="font-semibold text-slate-900">SHA eligibility</p>
          <p className="text-xs text-slate-500">
            Official check: identify the person in the Client Registry, then confirm contribution standing.
            {status?.mode === 'live'
              ? ' This hospital is connected to SHA HIE.'
              : status?.mode === 'stub'
                ? ' Practice mode only — not the live SHA network.'
                : ' Live SHA HIE is not connected yet. Use portal.sha.go.ke until DHA issues credentials.'}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          name="shaIdType"
          label="SHA identification type"
          value={identificationType}
          onChange={(e) => setIdentificationType(e.target.value)}
        >
          {SHA_IDENTIFICATION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </SelectField>
        <Field
          name="shaIdNumber"
          label="Identification number"
          value={identificationNumber}
          onChange={(e) => setIdentificationNumber(e.target.value)}
          placeholder={patientId ? 'Leave blank to use the file ID' : 'e.g. 12345678'}
        />
      </div>

      <Button type="button" variant="secondary" loading={check.isPending} onClick={() => check.mutate()}>
        Check SHA coverage
      </Button>

      {shown ? <ShaResult check={shown} /> : null}
    </div>
  )
}

function ShaResult({ check }: { check: ShaEligibilityCheck }) {
  const tone =
    check.outcome === 'eligible'
      ? 'success'
      : check.outcome === 'not_found'
        ? 'warning'
        : check.outcome === 'ineligible'
          ? 'error'
          : 'info'
  const title =
    check.outcome === 'eligible'
      ? 'Eligible — SHA coverage is active'
      : check.outcome === 'not_found'
        ? 'Not found — this is an identity problem, not an unpaid bill'
        : check.outcome === 'ineligible'
          ? 'Found, but SHA cover is not active'
          : 'SHA could not complete this check'

  return (
    <Alert tone={tone}>
      <p className="font-semibold">{title}</p>
      {check.source === 'stub' ? (
        <p className="mt-1 text-xs">Practice response. Do not tell a patient this came from SHA.</p>
      ) : null}
      {check.isAlive === false ? (
        <p className="mt-1">SHA records this person as deceased. Do not start a SHA visit.</p>
      ) : null}
      <p className="mt-2 text-sm">
        {check.fullName ? `${check.fullName} · ` : ''}
        {check.memberCrNumber ? `CR ${check.memberCrNumber}` : check.statusDesc || ''}
      </p>
      {check.schemes?.length ? (
        <ul className="mt-2 list-disc pl-5 text-sm">
          {check.schemes.map((scheme) => (
            <li key={`${scheme.schemeName}-${scheme.fund}`}>
              {scheme.schemeName}
              {scheme.fund ? ` · ${scheme.fund}` : ''}
              {scheme.status ? ` · ${scheme.status}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
      {check.pomsfEligible ? (
        <p className="mt-2 text-sm">POMSF / TSC / USALAMA cover detected — do not match POMSF as an exact string.</p>
      ) : null}
      {check.outcome === 'eligible' ? (
        <p className="mt-2 text-xs">
          Next official step: biometric consent on the HealthID workstation
          {check.whitelistedForOtp ? ', or OTP because this patient is whitelisted' : ''}. Claims are not cash
          amounts from the clinic fee list.
        </p>
      ) : null}
    </Alert>
  )
}
