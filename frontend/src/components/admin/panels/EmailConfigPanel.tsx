import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Field, PageHeader } from '../../ui'
import { apiRequest, formatApiError } from '../../../lib/api'
import { notify } from '../../../lib/notify'

type EmailStatus = {
  status: string
  deliveryEnabled: boolean
  deploymentDeliveryEnabled: boolean
  operatorDeliveryRequested: boolean
  configurationComplete: boolean
  smtpVerified: boolean
  smtpAccepted: boolean
  recipientDelivered: false
  smtpHostConfigured: boolean
  smtpHost: string | null
  smtpPort: number
  tlsMode: string
  tlsCertificateVerification: boolean
  smtpAuthConfigured: boolean
  fromAddress: string
  approvedSender: string
  senderApproved: boolean
  publicOriginConfigured: boolean
  publicOriginUsesHttps: boolean
  lastAcceptedAt: string | null
  lastFailureReason: string | null
  blockingReasons?: string[]
  recipientAllowlist: string[]
  allowUnrestrictedRecipients: boolean
  policies: {
    auth: boolean
    account: boolean
    operational: boolean
    reports: boolean
  }
  lastSmtpVerifyAt: string | null
  lastSmtpVerifyOk: boolean | null
  lastSmtpVerifyReason: string | null
  lastTestAt: string | null
  lastTestAccepted: boolean | null
  lastTestReason: string | null
  recommendedHost: string
  recommendedPort: number
  recommendedTlsMode: string
}

type EmailDeliveryRow = {
  id: string
  purpose: string
  recipientDomain: string
  subject: string
  status: string
  attempts: number
  lastErrorSafe?: string | null
  acceptedAt?: string | null
  createdAt: string
}

export function EmailConfigPanel() {
  const queryClient = useQueryClient()
  const [allowlistText, setAllowlistText] = useState<string | null>(null)
  const [testTo, setTestTo] = useState('')

  const { data: status, error } = useQuery({
    queryKey: ['admin-email-status'],
    queryFn: () => apiRequest<EmailStatus>('/admin/email/status'),
  })
  const { data: deliveries = [] } = useQuery({
    queryKey: ['admin-email-deliveries'],
    queryFn: () => apiRequest<EmailDeliveryRow[]>('/admin/email/deliveries?limit=20'),
  })

  const savePolicy = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest<EmailStatus>('/admin/email/policy', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      notify('Email policy saved', 'Non-secret settings were stored. SMTP passwords stay in server environment.', 'success')
      void queryClient.invalidateQueries({ queryKey: ['admin-email-status'] })
    },
    onError: (err: Error) => notify('Save failed', formatApiError(err, 'Could not save email policy.'), 'critical'),
  })
  const verify = useMutation({
    mutationFn: () => apiRequest<{ ok: boolean; reason: string }>('/admin/email/verify', { method: 'POST' }),
    onSuccess: (result) => {
      notify(result.ok ? 'SMTP connected' : 'SMTP not verified', result.reason, result.ok ? 'success' : 'critical')
      void queryClient.invalidateQueries({ queryKey: ['admin-email-status'] })
    },
    onError: (err: Error) => notify('Verify failed', formatApiError(err, 'Could not verify SMTP.'), 'critical'),
  })
  const test = useMutation({
    mutationFn: () =>
      apiRequest<{ accepted: boolean; reason?: string; recipientDelivered: boolean }>('/admin/email/test', {
        method: 'POST',
        body: JSON.stringify({ to: testTo }),
      }),
    onSuccess: (result) => {
      notify(
        result.accepted ? 'SMTP accepted the test' : 'Test not sent',
        result.accepted
          ? 'The mail server accepted the message. Mailbox delivery is not confirmed.'
          : result.reason ?? 'The test was not sent.',
        result.accepted ? 'success' : 'critical',
      )
      void queryClient.invalidateQueries({ queryKey: ['admin-email-status'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-email-deliveries'] })
    },
    onError: (err: Error) => notify('Test failed', formatApiError(err, 'Could not send a test email.'), 'critical'),
  })

  const allowlistValue = allowlistText ?? (status?.recipientAllowlist ?? []).join('\n')

  return (
    <div className="space-y-6">
      <Card className="p-8">
        <PageHeader
          title="Email configuration"
          description="Central SMTP for password resets, account notices, operational alerts, and authorised report links. Credentials stay in server environment. Delivery stays off until ICT enables EMAIL_DELIVERY_ENABLED and an administrator toggles operator delivery."
        />
        {error ? <Alert tone="error">{formatApiError(error, 'Unable to load email status.')}</Alert> : null}
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <StatusCell label="Approved sender" value={status?.approvedSender ?? 'noreply@jalaram.co.ke'} />
          <StatusCell label="Displayed sender" value={status?.fromAddress ?? '—'} />
          <StatusCell label="Sender approved" value={status?.senderApproved ? 'yes' : 'no'} />
          <StatusCell label="SMTP host" value={status?.smtpHost ?? 'not set'} />
          <StatusCell label="Port / TLS" value={status ? `${status.smtpPort} / ${status.tlsMode}` : '—'} />
          <StatusCell label="Auth configured" value={status?.smtpAuthConfigured ? 'yes' : 'no'} />
          <StatusCell label="Deployment kill-switch" value={status?.deploymentDeliveryEnabled ? 'on' : 'off'} />
          <StatusCell label="Operator delivery" value={status?.operatorDeliveryRequested ? 'requested' : 'off'} />
          <StatusCell label="Effective delivery" value={status?.deliveryEnabled ? 'on' : 'off'} />
          <StatusCell label="Configuration complete" value={status?.configurationComplete ? 'yes' : 'no'} />
          <StatusCell label="SMTP verified" value={status?.smtpVerified ? 'yes' : 'no'} />
          <StatusCell label="SMTP accepted a message" value={status?.smtpAccepted ? 'yes' : 'no'} />
          <StatusCell label="Recipient delivery proven" value="no" />
        </dl>
        <p className="mt-4 text-xs text-slate-500">
          Recommended mailbox: {status?.recommendedHost}:{status?.recommendedPort} ({status?.recommendedTlsMode} TLS),
          username {status?.approvedSender}. Do not paste the mailbox password here.
        </p>
        {status?.blockingReasons?.length ? (
          <Alert tone="warning" className="mt-4">
            <span className="font-semibold">Delivery is blocked. </span>
            {status.blockingReasons.join(' · ')}
          </Alert>
        ) : null}
        {status?.lastFailureReason ? (
          <p className="mt-3 text-sm text-rose-700">{status.lastFailureReason}</p>
        ) : null}
      </Card>

      <Card className="p-8">
        <h3 className="text-lg font-bold">Delivery policy</h3>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(status?.operatorDeliveryRequested)}
            onChange={(event) =>
              savePolicy.mutate({ operatorDeliveryRequested: event.target.checked })
            }
          />
          Operator requests delivery (still requires EMAIL_DELIVERY_ENABLED=true in the server environment)
        </label>
        <div className="mt-4 grid gap-2 text-sm">
          {(
            [
              ['auth', 'Authentication and password recovery'],
              ['account', 'Account and administrative notifications'],
              ['operational', 'Operational notifications'],
              ['reports', 'Authorised report delivery'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={status?.policies?.[key] !== false}
                onChange={(event) =>
                  savePolicy.mutate({ policies: { [key]: event.target.checked } })
                }
              />
              {label}
            </label>
          ))}
        </div>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Recipient allowlist (one address per line)
          </span>
          <textarea
            className="input min-h-[8rem]"
            value={allowlistValue}
            onChange={(event) => setAllowlistText(event.target.value)}
          />
        </label>
        <p className="mt-2 text-xs text-slate-500">
          An empty allowlist is not treated as safe. Staging must list approved ICT mailboxes before SMTP is used.
        </p>
        <Button
          type="button"
          className="mt-3"
          loading={savePolicy.isPending}
          onClick={() =>
            savePolicy.mutate({
              recipientAllowlist: allowlistValue
                .split(/[\n,;]+/)
                .map((row) => row.trim())
                .filter(Boolean),
            })
          }
        >
          Save allowlist
        </Button>
      </Card>

      <Card className="p-8">
        <h3 className="text-lg font-bold">Connection test</h3>
        <p className="mt-2 text-sm text-slate-600">
          Last verify: {status?.lastSmtpVerifyAt ? new Date(status.lastSmtpVerifyAt).toLocaleString() : 'never'}
          {status?.lastSmtpVerifyReason ? ` — ${status.lastSmtpVerifyReason}` : ''}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Last test send: {status?.lastTestAt ? new Date(status.lastTestAt).toLocaleString() : 'never'}
          {status?.lastTestReason ? ` — ${status.lastTestReason}` : ''}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" variant="secondary" loading={verify.isPending} onClick={() => verify.mutate()}>
            Verify SMTP connection
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field
            name="testTo"
            label="Allowlisted test recipient"
            value={testTo}
            onChange={(event) => setTestTo(event.target.value)}
          />
          <Button type="button" loading={test.isPending} onClick={() => test.mutate()}>
            Send test email
          </Button>
        </div>
      </Card>

      <Card className="p-8">
        <h3 className="text-lg font-bold">Recent attempts</h3>
        <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {deliveries.map((row) => (
            <li key={row.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">
                  {row.purpose} @{row.recipientDomain}
                </span>
                <span className="text-xs text-slate-500">
                  {row.status} · {row.attempts} attempt(s)
                </span>
              </div>
              <p className="text-slate-600">{row.subject}</p>
            </li>
          ))}
          {!deliveries.length ? (
            <li className="px-4 py-6 text-sm text-slate-500">No email delivery attempts recorded.</li>
          ) : null}
        </ul>
      </Card>
    </div>
  )
}

function StatusCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  )
}
