import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, PageHeader } from '../../ui'
import { apiRequest } from '../../../lib/api'

type Template = { id: string; key: string; channel: string; subject?: string | null; body: string }
type Settings = { smsSenderName: string }
type SmsLog = {
  id: string
  destination: string
  text: string
  provider: string
  deliveryStatus?: string | null
  providerMessageId?: string | null
  sentAt?: string | null
  createdAt: string
}
type BulkSmsResult = {
  ok: boolean
  provider: string
  recipients: number
  status: string
  providerMessageId?: string | null
}

const activeInternalEvents = [
  'Lab result ready / verified',
  'Critical lab result',
  'Radiology report ready / verified',
  'Referral received',
  'Appointment booked',
]

function parseMobiles(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\n,;]+/)
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ]
}

export function NotificationsConfigPanel() {
  const queryClient = useQueryClient()
  const [mobiles, setMobiles] = useState('')
  const [message, setMessage] = useState('')
  const [lastResult, setLastResult] = useState<BulkSmsResult | null>(null)

  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => apiRequest<Settings>('/admin/settings'),
  })
  const { data: templates = [] } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: () => apiRequest<Template[]>('/notifications/templates'),
  })
  const { data: smsLogs = [] } = useQuery({
    queryKey: ['sms-logs'],
    queryFn: () => apiRequest<SmsLog[]>('/notifications/sms/logs?limit=30'),
  })

  const bulkSms = useMutation({
    mutationFn: (payload: { mobiles: string[]; message: string }) =>
      apiRequest<BulkSmsResult>('/notifications/sms/bulk', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (result) => {
      setLastResult(result)
      setMobiles('')
      setMessage('')
      void queryClient.invalidateQueries({ queryKey: ['sms-logs'] })
    },
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const list = parseMobiles(mobiles)
    if (!list.length || !message.trim()) return
    bulkSms.mutate({ mobiles: list, message: message.trim() })
  }

  return (
    <div className="space-y-6">
      <Card className="p-8">
        <PageHeader
          title="Notification configuration"
          description="Celcom Africa SMS, templates, and internal alert types for Jalaram Hospital."
        />
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold">SMS settings</p>
            <p className="mt-2 text-sm text-slate-600">
              Sender / shortcode: <strong>{settings?.smsSenderName ?? 'JALARAM'}</strong>
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Set <code className="rounded bg-white px-1">SMS_PROVIDER=celcom_africa</code> with{' '}
              <code className="rounded bg-white px-1">CELCOM_API_KEY</code>,{' '}
              <code className="rounded bg-white px-1">CELCOM_PARTNER_ID</code>, and{' '}
              <code className="rounded bg-white px-1">CELCOM_SHORTCODE</code> in environment. Use{' '}
              <code className="rounded bg-white px-1">stub</code> for local dry-runs.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-5">
            <p className="text-sm font-semibold">Active internal alerts</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {activeInternalEvents.map((event) => (
                <li key={event}>• {event}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card className="p-8">
        <PageHeader
          title="Bulk SMS"
          description="Send one message to many Kenyan numbers via Celcom Africa (comma or newline separated)."
        />
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Recipients</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              rows={4}
              placeholder={'0712345678\n254700000000'}
              value={mobiles}
              onChange={(e) => setMobiles(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Message</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              rows={4}
              placeholder="Dear patient, your appointment is tomorrow at 9am. — Jalaram Hospital"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              maxLength={640}
            />
            <span className="mt-1 block text-xs text-slate-500">{message.length}/640 characters</span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={bulkSms.isPending}>
              {bulkSms.isPending ? 'Sending…' : `Send to ${parseMobiles(mobiles).length || 0} recipient(s)`}
            </Button>
            {lastResult ? (
              <p className="text-sm text-emerald-700">
                Sent via {lastResult.provider}: {lastResult.recipients} recipient(s) — {lastResult.status}
              </p>
            ) : null}
            {bulkSms.isError ? (
              <p className="text-sm text-rose-700">
                {(bulkSms.error as Error)?.message ?? 'SMS send failed'}
              </p>
            ) : null}
          </div>
        </form>

        <div className="mt-8">
          <p className="text-sm font-semibold text-slate-800">Recent SMS log</p>
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {smsLogs.map((log) => (
              <li key={log.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-slate-800">{log.destination}</span>
                  <span className="text-xs text-slate-500">
                    {log.provider} · {log.deliveryStatus ?? '—'} ·{' '}
                    {new Date(log.sentAt ?? log.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-slate-600">{log.text}</p>
              </li>
            ))}
            {!smsLogs.length ? (
              <li className="px-4 py-6 text-sm text-slate-500">No SMS sent yet.</li>
            ) : null}
          </ul>
        </div>
      </Card>

      <Card className="p-8">
        <PageHeader title="SMS templates" description="Seeded templates — edit via database or future template editor." />
        <ul className="mt-6 space-y-3">
          {templates.map((template) => (
            <li key={template.id} className="rounded-xl border border-slate-200 p-4 text-sm">
              <p className="font-semibold">
                {template.key} <span className="text-xs font-normal text-slate-500">({template.channel})</span>
              </p>
              {template.subject ? <p className="text-xs text-slate-500">Subject: {template.subject}</p> : null}
              <p className="mt-1 text-slate-600">{template.body}</p>
            </li>
          ))}
          {!templates.length ? <p className="text-sm text-slate-500">No templates found.</p> : null}
        </ul>
      </Card>
    </div>
  )
}
