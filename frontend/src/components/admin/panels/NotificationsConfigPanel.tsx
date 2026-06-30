import { useQuery } from '@tanstack/react-query'
import { Card, PageHeader } from '../../ui'
import { apiRequest } from '../../../lib/api'

type Template = { id: string; key: string; channel: string; subject?: string | null; body: string }
type Settings = { smsSenderName: string }

const activeInternalEvents = [
  'Lab result ready / verified',
  'Critical lab result',
  'Radiology report ready / verified',
  'Referral received',
  'Appointment booked',
]

export function NotificationsConfigPanel() {
  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => apiRequest<Settings>('/admin/settings'),
  })
  const { data: templates = [] } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: () => apiRequest<Template[]>('/notifications/templates'),
  })

  return (
    <div className="space-y-6">
      <Card className="p-8">
        <PageHeader
          title="Notification configuration"
          description="SMS sender, templates, and internal alert types."
        />
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold">SMS settings</p>
            <p className="mt-2 text-sm text-slate-600">
              Sender name: <strong>{settings?.smsSenderName ?? 'AfyaSasa'}</strong>
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Provider configured via <code className="rounded bg-white px-1">SMS_PROVIDER</code> in environment
              (stub, africas_talking, or twilio). Update sender name under Hospital profile settings.
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
