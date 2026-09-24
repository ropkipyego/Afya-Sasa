import type { ReactNode } from 'react'
import { useAuthStore } from '../../lib/auth-store'

export function DepartmentWorkspaceHeader({
  department,
  roleHint,
  actions,
}: {
  department: string
  roleHint?: string
  actions?: ReactNode
}) {
  const user = useAuthStore((state) => state.user)
  const today = new Date().toLocaleDateString('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

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
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}
