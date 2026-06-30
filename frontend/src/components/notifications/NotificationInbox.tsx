import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, ClipboardList, FlaskConical } from 'lucide-react'
import clsx from 'clsx'
import { Button, Card, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'

type InboxItem = {
  id: string
  title: string
  body: string
  severity: 'info' | 'warning' | 'critical'
  link: string | null
  readAt: string | null
  createdAt: string
}

const severityTone: Record<string, string> = {
  info: 'border-slate-200 bg-white',
  warning: 'border-amber-200 bg-amber-50',
  critical: 'border-red-200 bg-red-50',
}

type InboxTab = 'all' | 'tasks' | 'results' | 'reviews'

const linkToScreen: Record<string, string> = {
  '/laboratory': 'Laboratory',
  '/radiology': 'Radiology',
  '/referrals': 'Referrals',
  '/appointments': 'Appointments',
}

export function NotificationInbox({ onNavigate }: { onNavigate?: (screen: string) => void }) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<InboxTab>('all')

  const { data: inbox = [], isLoading } = useQuery({
    queryKey: ['notification-inbox'],
    queryFn: () => apiRequest<InboxItem[]>('/notifications/inbox'),
    refetchInterval: 30_000,
  })

  const { data: summary } = useQuery({
    queryKey: ['notification-summary'],
    queryFn: () => apiRequest<{ unread: number; total: number }>('/notifications/inbox/summary'),
    refetchInterval: 30_000,
  })

  const markRead = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/notifications/inbox/${id}/read`, { method: 'PATCH' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification-inbox'] })
      await queryClient.invalidateQueries({ queryKey: ['notification-summary'] })
    },
  })

  const markAllRead = useMutation({
    mutationFn: () => apiRequest('/notifications/inbox/read-all', { method: 'PATCH' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification-inbox'] })
      await queryClient.invalidateQueries({ queryKey: ['notification-summary'] })
    },
  })

  const filtered = inbox.filter((item) => {
    if (tab === 'all') return true
    const t = item.title.toLowerCase()
    if (tab === 'results') return t.includes('lab') || t.includes('radiology') || t.includes('result')
    if (tab === 'reviews') return t.includes('referral') || t.includes('review') || t.includes('pending')
    if (tab === 'tasks') return !item.readAt
    return true
  })

  const tabs: { id: InboxTab; label: string; icon: typeof Bell }[] = [
    { id: 'all', label: 'My notifications', icon: Bell },
    { id: 'tasks', label: 'My tasks', icon: ClipboardList },
    { id: 'results', label: 'Pending results', icon: FlaskConical },
    { id: 'reviews', label: 'Pending reviews', icon: CheckCheck },
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHeader
            title="Notification center"
            description={`${summary?.unread ?? 0} unread · ${summary?.total ?? 0} total`}
          />
          {(summary?.unread ?? 0) > 0 ? (
            <Button
              type="button"
              variant="secondary"
              loading={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
                tab === t.id ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="mt-6 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-skeleton rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            {filtered.map((item) => (
              <div
                key={item.id}
                role={item.link && onNavigate ? 'button' : undefined}
                tabIndex={item.link && onNavigate ? 0 : undefined}
                onClick={() => {
                  if (item.link && onNavigate) {
                    const screen = linkToScreen[item.link]
                    if (screen) onNavigate(screen)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && item.link && onNavigate) {
                    const screen = linkToScreen[item.link]
                    if (screen) onNavigate(screen)
                  }
                }}
                className={clsx(
                  'card-hover rounded-xl border p-4 transition queue-item-enter',
                  severityTone[item.severity],
                  !item.readAt && 'ring-1 ring-teal-200',
                  item.link && onNavigate && 'cursor-pointer',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!item.readAt ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="shrink-0 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        markRead.mutate(item.id)
                      }}
                    >
                      Mark read
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
            {!filtered.length ? (
              <p className="py-16 text-center text-sm text-slate-500">
                No notifications in this view. Lab results, referrals, and appointment reminders appear here.
              </p>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  )
}
