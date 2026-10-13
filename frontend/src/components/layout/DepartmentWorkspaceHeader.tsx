import type { ReactNode } from 'react'
import { useAuthStore } from '../../lib/auth-store'
import type { PaymentServiceLine } from '../../lib/payments'
import { DepartmentRevenueStrip } from './DepartmentRevenueStrip'

export function DepartmentWorkspaceHeader({
  department,
  roleHint,
  actions,
  serviceLine,
}: {
  department: string
  roleHint?: string
  actions?: ReactNode
  serviceLine?: PaymentServiceLine | 'all'
}) {
  const user = useAuthStore((state) => state.user)
  let today: string
  try {
    today = new Date().toLocaleDateString('en-KE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    today = new Date().toISOString().slice(0, 10)
  }

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{department}</p>
        <p className="text-sm text-slate-600">{today}</p>
        <p className="text-xs text-slate-500">
          {user ? `${user.firstName} ${user.lastName}` : 'Staff'}
          {user?.roles?.length ? ` · ${user.roles.join(', ')}` : ''}
          {roleHint ? ` · ${roleHint}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {serviceLine ? <DepartmentRevenueStrip serviceLine={serviceLine} /> : null}
        {actions}
      </div>
    </div>
  )
}
