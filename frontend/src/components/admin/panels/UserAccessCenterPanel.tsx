import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  KeyRound,
  Lock,
  LockOpen,
  Pencil,
  Search,
  Stethoscope,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react'
import { Alert, Button, Card, Field, PageHeader } from '../../ui'
import { formDataFromElement, submitFormMutation } from '../../../lib/form-utils'
import { apiRequest } from '../../../lib/api'
import { notify } from '../../../lib/notify'
import { useAuthStore } from '../../../lib/auth-store'

type RoleItem = { id: string; name: string; label: string }
type AdminUserItem = {
  id: string
  employeeNo: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  specialisation?: string | null
  active: boolean
  forcePasswordChange?: boolean
  lockedUntil?: string | null
  roles: RoleItem[]
  departments?: { id: string; name: string; isPrimary?: boolean }[]
}

type ClinicalStaffItem = {
  id: string
  firstName: string
  lastName: string
  specialisation: string | null
  label: string
}

type UserSummary = {
  activeUsers: number
  inactiveUsers: number
  lockedAccounts: number
  forcePasswordChange: number
}

const CLINICAL_ROLE_NAMES = new Set(['doctor', 'consultant', 'clinical_officer'])

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
  const canManageUsers = useAuthStore((state) =>
    state.user?.permissions.includes('users:manage'),
  )
  const canManageDepartments = useAuthStore((state) =>
    state.user?.permissions.includes('departments:manage'),
  )

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [addMode, setAddMode] = useState<'user' | 'doctor'>('user')
  const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null)
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null)

  const { data: summary } = useQuery({
    queryKey: ['admin-users-summary'],
    queryFn: () => apiRequest<UserSummary>('/admin/users/summary'),
    enabled: canManageUsers,
  })
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiRequest<AdminUserItem[]>('/admin/users'),
    enabled: canManageUsers,
  })
  const { data: roles = [] } = useQuery({
    queryKey: ['admin-user-role-options'],
    queryFn: () => apiRequest<RoleItem[]>('/admin/users/role-options'),
    enabled: canManageUsers,
  })
  const { data: departments = [] } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: () => apiRequest<{ id: string; name: string; code: string }[]>('/admin/departments'),
    enabled: canManageDepartments,
  })
  const { data: clinicalStaff = [] } = useQuery({
    queryKey: ['admin-clinical-staff'],
    queryFn: () => apiRequest<ClinicalStaffItem[]>('/admin/clinical-staff'),
    enabled: canManageUsers,
  })

  const doctorRole = roles.find((role) => role.name === 'doctor')

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    await queryClient.invalidateQueries({ queryKey: ['admin-users-summary'] })
    await queryClient.invalidateQueries({ queryKey: ['admin-clinical-staff'] })
    await queryClient.invalidateQueries({ queryKey: ['clinical-catalog'] })
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
          specialisation: form.get('specialisation') || undefined,
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

  const updateUser = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      const id = form.get('userId')?.toString()
      const roleId = form.get('roleId')?.toString()
      return apiRequest(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          employeeNo: form.get('employeeNo'),
          firstName: form.get('firstName'),
          lastName: form.get('lastName'),
          email: form.get('email'),
          phone: form.get('phone') || undefined,
          specialisation: form.get('specialisation') || undefined,
          roleIds: roleId ? [roleId] : [],
        }),
      })
    },
    onSuccess: async () => {
      notify('User updated', 'Staff profile saved.', 'success')
      setEditingUser(null)
      await invalidate()
    },
  })

  const resetPassword = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      const id = form.get('userId')?.toString()
      return apiRequest(`/admin/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({
          temporaryPassword: form.get('temporaryPassword'),
        }),
      })
    },
    onSuccess: async () => {
      notify('Password reset', 'User must change password on next login.', 'success')
      setResetPasswordUserId(null)
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

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return users.filter((user) => {
      const matchesSearch =
        !query ||
        `${user.firstName} ${user.lastName}`.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.employeeNo.toLowerCase().includes(query) ||
        (user.specialisation ?? '').toLowerCase().includes(query)
      const matchesRole =
        !roleFilter || user.roles.some((role) => role.id === roleFilter || role.name === roleFilter)
      return matchesSearch && matchesRole
    })
  }, [users, search, roleFilter])

  const stats = [
    { label: 'Active users', value: summary?.activeUsers ?? users.filter((u) => u.active).length },
    { label: 'Clinical staff', value: clinicalStaff.length },
    { label: 'Locked', value: summary?.lockedAccounts ?? 0 },
    { label: 'Password change due', value: summary?.forcePasswordChange ?? 0 },
  ]

  if (!canManageUsers) {
    return (
      <Alert tone="warning">
        You need the <strong>users:manage</strong> permission to create or manage staff accounts.
        Ask a hospital administrator to grant access or create accounts for you.
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <PageHeader
          title="Account control center"
          description="Manage staff access — new doctors with specialisation appear immediately in clinical workflows."
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

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold">Clinical staff directory</h3>
          <span className="text-sm text-slate-500">{clinicalStaff.length} doctors in workflows</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clinicalStaff.map((doctor) => (
            <div key={doctor.id} className="rounded-xl border border-teal-100 bg-teal-50/50 p-4">
              <div className="flex items-start gap-2">
                <Stethoscope className="mt-0.5 h-4 w-4 text-teal-700" />
                <div>
                  <p className="font-semibold text-slate-900">{doctor.label}</p>
                  <p className="text-sm text-teal-800">
                    {doctor.specialisation || 'General practice'}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {!clinicalStaff.length ? (
            <p className="text-sm text-slate-500 sm:col-span-2 lg:col-span-3">
              No clinical staff yet. Use &quot;Quick add doctor&quot; to create accounts that appear in OPD,
              referrals, and orders.
            </p>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={addMode === 'user' ? 'primary' : 'secondary'}
                className="text-xs"
                onClick={() => setAddMode('user')}
              >
                Add user
              </Button>
              <Button
                type="button"
                variant={addMode === 'doctor' ? 'primary' : 'secondary'}
                className="text-xs"
                onClick={() => setAddMode('doctor')}
              >
                <Stethoscope className="h-3.5 w-3.5" />
                Quick add doctor
              </Button>
            </div>
            <h3 className="mt-4 text-lg font-bold">
              {addMode === 'doctor' ? 'Add doctor' : 'Add user'}
            </h3>
            <form
              key={addMode}
              className="mt-4 space-y-4"
              onSubmit={(event) => submitFormMutation(createUser, event)}
            >
              <Field name="employeeNo" label="Employee no." required />
              <Field name="firstName" label="First name" required />
              <Field name="lastName" label="Last name" required />
              <Field name="email" label="Email" type="email" required />
              <Field name="phone" label="Phone" />
              {addMode === 'doctor' ? (
                <Field
                  name="specialisation"
                  label="Specialisation"
                  required
                  placeholder="e.g. Internal Medicine, Paediatrics"
                />
              ) : (
                <Field name="specialisation" label="Specialisation (optional)" />
              )}
              <Field
                name="temporaryPassword"
                label="Temporary password"
                type="password"
                hint="Minimum 10 characters. The user must change this on first login."
                required
              />
              <label>
                <span className="text-sm font-semibold">Role</span>
                <select
                  name="roleId"
                  className="input mt-2 w-full"
                  defaultValue={addMode === 'doctor' ? doctorRole?.id ?? '' : ''}
                >
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
                {addMode === 'doctor' ? 'Create doctor account' : 'Create user'}
              </Button>
            </form>
            {createUser.error ? <Alert tone="error">{createUser.error.message}</Alert> : null}
          </Card>

          {canManageDepartments ? (
            <>
              <QuickAddForm
                title="Create department"
                pending={createDepartment.isPending}
                onSubmit={(event) => submitFormMutation(createDepartment, event)}
              >
                <input name="name" className="input w-full" placeholder="Department name" required />
                <input name="code" className="input w-full" placeholder="Code" required />
                <input name="type" className="input w-full" placeholder="clinical / diagnostic / admin" />
              </QuickAddForm>

              <QuickAddForm
                title="Assign department"
                pending={assignDepartment.isPending}
                onSubmit={(event) => submitFormMutation(assignDepartment, event)}
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
            </>
          ) : null}
        </div>

        <Card className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-bold">Staff directory</h3>
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input w-full pl-9"
                placeholder="Search name, email, employee no…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="input"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All roles</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Showing {filteredUsers.length} of {users.length} accounts
          </p>
          <div className="mt-4 space-y-3">
            {filteredUsers.map((user) => (
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
                    {user.specialisation ? (
                      <p className="text-sm text-slate-600">{user.specialisation}</p>
                    ) : null}
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
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => {
                      setEditingUser(user)
                      setResetPasswordUserId(null)
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => {
                      setResetPasswordUserId(user.id)
                      setEditingUser(null)
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Reset password
                  </Button>
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
                  {user.roles.some((role) => CLINICAL_ROLE_NAMES.has(role.name)) ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800">
                      <Stethoscope className="h-3 w-3" />
                      In clinical workflows
                    </span>
                  ) : null}
                </div>

                {editingUser?.id === user.id ? (
                  <form
                    className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                    onSubmit={(event) => submitFormMutation(updateUser, event)}
                  >
                    <input type="hidden" name="userId" value={user.id} />
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold">Edit staff profile</p>
                      <button type="button" onClick={() => setEditingUser(null)}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <Field name="employeeNo" label="Employee no." defaultValue={user.employeeNo} required />
                    <Field name="firstName" label="First name" defaultValue={user.firstName} required />
                    <Field name="lastName" label="Last name" defaultValue={user.lastName} required />
                    <Field name="email" label="Email" type="email" defaultValue={user.email} required />
                    <Field name="phone" label="Phone" defaultValue={user.phone ?? ''} />
                    <Field
                      name="specialisation"
                      label="Specialisation"
                      defaultValue={user.specialisation ?? ''}
                    />
                    <label>
                      <span className="text-sm font-semibold">Role</span>
                      <select
                        name="roleId"
                        className="input mt-2 w-full"
                        defaultValue={user.roles[0]?.id ?? ''}
                      >
                        <option value="">No role</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button type="submit" loading={updateUser.isPending} className="text-xs">
                      Save changes
                    </Button>
                  </form>
                ) : null}

                {resetPasswordUserId === user.id ? (
                  <form
                    className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4"
                    onSubmit={(event) => submitFormMutation(resetPassword, event)}
                  >
                    <input type="hidden" name="userId" value={user.id} />
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold">Reset password</p>
                      <button type="button" onClick={() => setResetPasswordUserId(null)}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <Field
                      name="temporaryPassword"
                      label="New temporary password"
                      type="password"
                      hint="Minimum 10 characters. User sessions will be signed out."
                      required
                    />
                    <Button type="submit" loading={resetPassword.isPending} variant="secondary" className="text-xs">
                      Reset password
                    </Button>
                  </form>
                ) : null}
              </div>
            ))}
            {!filteredUsers.length ? (
              <p className="text-sm text-slate-500">No staff match your search.</p>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  )
}
