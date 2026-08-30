import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, ClipboardList, FlaskConical, Inbox } from 'lucide-react'
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

const severityDot: Record<string, string> = {
  info: 'bg-slate-400',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
}

type InboxTab = 'all' | 'unread' | 'results' | 'reviews'

const linkToScreen: Record<string, string> = {
  '/laboratory': 'Laboratory',
  '/radiology': 'Radiology',
  '/referrals': 'Referrals',
  '/appointments': 'Appointments',
  '/opd': 'Doctor Queue',
  '/doctor': 'Doctor Queue',
  '/doctor-queue': 'Doctor Queue',
  '/results': 'Laboratory',
  '/results-inbox': 'Laboratory',
  '/pharmacy': 'Pharmacy',
  '/clinical-orders': 'Orders',
  '/emergency': 'Emergency',
  '/inpatient': 'Inpatient (IPD)',
  '/inventory': 'Inventory & Store',
  '/store': 'Inventory & Store',
}

function resolveScreen(link: string | null): string | undefined {
  if (!link?.trim()) return undefined
  const raw = link.trim()
  return (
    linkToScreen[raw] ||
    linkToScreen[raw.replace(/\/$/, '')] ||
    (raw && !raw.startsWith('/') ? raw : undefined)
  )
}

export function NotificationInbox({
  onNavigate,
  onClose,
}: {
  onNavigate?: (screen: string) => void
  onClose?: () => void
}) {
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
    const t = item.title.toLowerCase()
    if (tab === 'unread') return !item.readAt
    if (tab === 'results') return t.includes('lab') || t.includes('radiology') || t.includes('result')
    if (tab === 'reviews') return t.includes('referral') || t.includes('review') || t.includes('pending')
    return true
  })

  const tabs: { id: InboxTab; label: string; icon: typeof Bell; count?: number }[] = [
    { id: 'all', label: 'All', icon: Inbox, count: summary?.total },
    { id: 'unread', label: 'Unread', icon: Bell, count: summary?.unread },
    { id: 'results', label: 'Results', icon: FlaskConical },
    { id: 'reviews', label: 'Reviews', icon: CheckCheck },
  ]

  const openItem = (item: InboxItem) => {
    if (!item.readAt) markRead.mutate(item.id)
    const screen = resolveScreen(item.link)
    if (screen && onNavigate) onNavigate(screen)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <Card className="overflow-hidden p-0">
        <div className="bg-gradient-to-br from-slate-900 to-teal-950 p-6 text-white">
          <div className="flex items-start justify-between gap-3">
            <PageHeader
              title="Notifications"
              description={`${summary?.unread ?? 0} unread · ${summary?.total ?? 0} total`}
            />
            {onClose ? (
              <button
                type="button"
                className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/10"
                onClick={onClose}
              >
                Close
              </button>
            ) : null}
          </div>
          {(summary?.unread ?? 0) > 0 ? (
            <Button
              type="button"
              variant="secondary"
              className="mt-4 border-white/20 bg-white/10 text-white hover:bg-white/20"
              loading={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          ) : null}
        </div>

        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex flex-wrap gap-2">
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
                {t.count != null && t.count > 0 ? (
                  <span className={clsx('rounded-full px-1.5 py-0.5 text-[10px]', tab === t.id ? 'bg-white/20' : 'bg-white')}>
                    {t.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 animate-skeleton rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((item) => {
                const screen = resolveScreen(item.link)
                const clickable = Boolean(screen && onNavigate)
                return (
                  <div
                    key={item.id}
                    role={clickable ? 'button' : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    onClick={() => clickable && openItem(item)}
                    onKeyDown={(e) => e.key === 'Enter' && clickable && openItem(item)}
                    className={clsx(
                      'rounded-xl border p-4 transition',
                      severityTone[item.severity],
                      !item.readAt && 'ring-1 ring-teal-200',
                      clickable && 'cursor-pointer hover:shadow-md',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', severityDot[item.severity])} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={clsx('font-semibold', !item.readAt && 'text-slate-900')}>{item.title}</p>
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
                        <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span>{new Date(item.createdAt).toLocaleString()}</span>
                          {screen ? <span className="text-teal-700">→ {screen}</span> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {!filtered.length ? (
                <div className="py-16 text-center">
                  <ClipboardList className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm text-slate-500">Nothing in this view.</p>
                  <p className="mt-1 text-xs text-slate-400">Lab results, referrals, and tasks appear here automatically.</p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
