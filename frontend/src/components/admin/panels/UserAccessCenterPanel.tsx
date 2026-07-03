import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  KeyRound,
  Lock,
  LockOpen,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import { Alert, Button, Card, Field, PageHeader } from '../../ui'
import { formDataFromElement } from '../../../lib/form-utils'
import { apiRequest } from '../../../lib/api'
import { notify } from '../../../lib/notify'

type RoleItem = { id: string; name: string; label: string }
type AdminUserItem = {
  id: string
  employeeNo: string
  firstName: string
  lastName: string
  email: string
  active: boolean
  forcePasswordChange?: boolean
  lockedUntil?: string | null
  roles: RoleItem[]
  departments?: { id: string; name: string; isPrimary?: boolean }[]
}

type UserSummary = {
  activeUsers: number
  inactiveUsers: number
  lockedAccounts: number
  forcePasswordChange: number
}

function QuickAddForm({
  title,
  children,
  pending,
  onSubmit,
}: {
  title: string
  children: React.ReactNode
  pending: boolean
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5" onSubmit={onSubmit}>
      <h4 className="font-bold">{title}</h4>
      {children}
      <Button type="submit" loading={pending} variant="secondary">
        Save
      </Button>
    </form>
  )
}

export function UserAccessCenterPanel() {
  const queryClient = useQueryClient()
  const { data: summary } = useQuery({
    queryKey: ['admin-users-summary'],
    queryFn: () => apiRequest<UserSummary>('/admin/users/summary'),
  })
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiRequest<AdminUserItem[]>('/admin/users'),
  })
  const { data: roles = [] } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => apiRequest<RoleItem[]>('/admin/roles'),
  })
  const { data: departments = [] } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: () => apiRequest<{ id: string; name: string; code: string }[]>('/admin/departments'),
  })

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    await queryClient.invalidateQueries({ queryKey: ['admin-users-summary'] })
  }

  const createUser = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      const roleId = form.get('roleId')?.toString()
      return apiRequest('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          employeeNo: form.get('employeeNo'),
          firstName: form.get('firstName'),
          lastName: form.get('lastName'),
          email: form.get('email'),
          phone: form.get('phone'),
          temporaryPassword: form.get('temporaryPassword'),
          roleIds: roleId ? [roleId] : [],
        }),
      })
    },
    onSuccess: async () => {
      notify('User created', 'Staff account is ready for first login.', 'success')
      await invalidate()
    },
  })

  const createDepartment = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/admin/departments', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          code: form.get('code'),
          type: form.get('type') || undefined,
        }),
      })
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['admin-departments'] }),
  })

  const assignDepartment = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest(`/admin/users/${form.get('userId')}/departments`, {
        method: 'POST',
        body: JSON.stringify({
          departmentId: form.get('departmentId'),
          isPrimary: form.get('isPrimary') === 'on',
        }),
      })
    },
    onSuccess: invalidate,
  })

  const userAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'activate' | 'deactivate' | 'unlock' }) =>
      apiRequest(`/admin/users/${id}/${action}`, { method: 'POST' }),
    onSuccess: invalidate,
  })

  const stats = [
    { label: 'Active users', value: summary?.activeUsers ?? users.filter((u) => u.active).length },
    { label: 'Inactive', value: summary?.inactiveUsers ?? users.filter((u) => !u.active).length },
    { label: 'Locked', value: summary?.lockedAccounts ?? 0 },
    { label: 'Password change due', value: summary?.forcePasswordChange ?? 0 },
  ]

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <PageHeader
          title="Account control center"
          description="Manage staff access — new doctors appear immediately in clinical workflows."
        />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stat.value}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-bold">Add user</h3>
            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                createUser.mutate(event.currentTarget)
                event.currentTarget.reset()
              }}
            >
              <Field name="employeeNo" label="Employee no." required />
              <Field name="firstName" label="First name" required />
              <Field name="lastName" label="Last name" required />
              <Field name="email" label="Email" type="email" required />
              <Field name="phone" label="Phone" />
              <Field name="temporaryPassword" label="Temporary password" type="password" required />
              <label>
                <span className="text-sm font-semibold">Role</span>
                <select name="roleId" className="input mt-2 w-full">
                  <option value="">No role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" loading={createUser.isPending}>
                <UserPlus className="h-4 w-4" />
                Create user
              </Button>
            </form>
            {createUser.error ? <Alert tone="error">{createUser.error.message}</Alert> : null}
          </Card>

          <QuickAddForm
            title="Create department"
            pending={createDepartment.isPending}
            onSubmit={(event) => {
              event.preventDefault()
              createDepartment.mutate(event.currentTarget)
              event.currentTarget.reset()
            }}
          >
            <input name="name" className="input w-full" placeholder="Department name" required />
            <input name="code" className="input w-full" placeholder="Code" required />
            <input name="type" className="input w-full" placeholder="clinical / diagnostic / admin" />
          </QuickAddForm>

          <QuickAddForm
            title="Assign department"
            pending={assignDepartment.isPending}
            onSubmit={(event) => {
              event.preventDefault()
              assignDepartment.mutate(event.currentTarget)
              event.currentTarget.reset()
            }}
          >
            <select name="userId" className="input w-full" required>
              <option value="">Select user</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName}
                </option>
              ))}
            </select>
            <select name="departmentId" className="input w-full" required>
              <option value="">Select department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input name="isPrimary" type="checkbox" /> Primary department
            </label>
          </QuickAddForm>
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-bold">Staff directory</h3>
          <div className="mt-4 space-y-3">
            {users.map((user) => (
              <div key={user.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-sm text-slate-500">
                      {user.employeeNo} · {user.email}
                    </p>
                    <p className="mt-1 text-sm text-teal-800">
                      {user.roles.map((role) => role.label).join(', ') || 'No roles'}
                    </p>
                    <p className="text-xs text-slate-500">
                      Departments:{' '}
                      {user.departments?.map((d) => d.name).join(', ') || 'none'}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-bold ${
                      user.active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {user.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {user.active ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-xs"
                      onClick={() => userAction.mutate({ id: user.id, action: 'deactivate' })}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-xs"
                      onClick={() => userAction.mutate({ id: user.id, action: 'activate' })}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Activate
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => userAction.mutate({ id: user.id, action: 'unlock' })}
                  >
                    {user.lockedUntil ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    Unlock
                  </Button>
                  {user.forcePasswordChange ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                      <KeyRound className="h-3 w-3" />
                      Password change required
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
