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
import { apiRequest, getApiErrorStatus } from '../../../lib/api'
import { notify } from '../../../lib/notify'
import { useAuthStore } from '../../../lib/auth-store'
import { endSession } from '../../../lib/auth-session'

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

function accountActionError(error: unknown, fallback: string) {
  const status = getApiErrorStatus(error)
  const message = error instanceof Error ? error.message : fallback
  if (status === 400) return message
  if (status === 401) return 'Your session expired. Sign in again.'
  if (status === 403) return message || 'You do not have permission to manage this account.'
  if (status === 404) return 'User or role was not found.'
  if (status === 409) return message
  if (status === 500 || status === 502 || status === 503) return fallback
  return message
}

function RoleChecklist({
  name,
  roles,
  selectedIds,
  onChange,
  disabled,
}: {
  name: string
  roles: RoleItem[]
  selectedIds?: string[]
  onChange?: (ids: string[]) => void
  disabled?: boolean
}) {
  const selected = new Set(selectedIds ?? [])
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-semibold">Roles</legend>
      <p className="text-xs text-slate-500">A person can hold more than one role. Tick every role they should keep.</p>
      {roles.map((role) => (
        <label key={role.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={name}
            value={role.id}
            checked={onChange ? selected.has(role.id) : undefined}
            defaultChecked={!onChange ? selected.has(role.id) : undefined}
            onChange={
              onChange
                ? (event) => {
                    const next = new Set(selected)
                    if (event.target.checked) next.add(role.id)
                    else next.delete(role.id)
                    onChange([...next])
                  }
                : undefined
            }
          />
          <span>
            {role.label}
            <span className="ml-1 text-xs text-slate-400">{role.name}</span>
          </span>
        </label>
      ))}
      {!roles.length ? <p className="text-xs text-slate-500">No assignable roles available.</p> : null}
    </fieldset>
  )
}

function QuickAddForm({
  title,
  children,
  pending,
  error,
  onSubmit,
}: {
  title: string
  children: React.ReactNode
  pending: boolean
  error?: string | null
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5" onSubmit={onSubmit}>
      <h4 className="font-bold">{title}</h4>
      {children}
      <Button type="submit" loading={pending} disabled={pending} variant="secondary">
        {pending ? 'Saving…' : 'Save'}
      </Button>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </form>
  )
}

export function UserAccessCenterPanel() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.user)
  const canManageUsers = currentUser?.permissions.includes('users:manage')
  const canManageDepartments = currentUser?.permissions.includes('departments:manage')
  const currentIsSuperadmin = currentUser?.roles.includes('superadmin') ?? false

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [addMode, setAddMode] = useState<'user' | 'doctor'>('user')
  const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null)
  const [editRoleIds, setEditRoleIds] = useState<string[]>([])
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null)
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null)
  const [actionErrorUserId, setActionErrorUserId] = useState<string | null>(null)

  const {
    data: summary,
    isLoading: summaryLoading,
  } = useQuery({
    queryKey: ['admin-users-summary'],
    queryFn: () => apiRequest<UserSummary>('/admin/users/summary'),
    enabled: Boolean(canManageUsers),
  })
  const {
    data: users = [],
    isLoading: usersLoading,
    isError: usersError,
    error: usersQueryError,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiRequest<AdminUserItem[]>('/admin/users'),
    enabled: Boolean(canManageUsers),
  })
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['admin-user-role-options'],
    queryFn: () => apiRequest<RoleItem[]>('/admin/users/role-options'),
    enabled: Boolean(canManageUsers),
  })
  const { data: departments = [] } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: () => apiRequest<{ id: string; name: string; code: string }[]>('/admin/departments'),
    enabled: Boolean(canManageDepartments),
  })
  const { data: clinicalStaff = [] } = useQuery({
    queryKey: ['admin-clinical-staff'],
    queryFn: () => apiRequest<ClinicalStaffItem[]>('/admin/clinical-staff'),
    enabled: Boolean(canManageUsers),
  })

  const doctorRole = roles.find((role) => role.name === 'doctor')
  const assignableRoleIds = useMemo(() => new Set(roles.map((role) => role.id)), [roles])

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    await queryClient.invalidateQueries({ queryKey: ['admin-users-summary'] })
    await queryClient.invalidateQueries({ queryKey: ['admin-clinical-staff'] })
    await queryClient.invalidateQueries({ queryKey: ['clinical-catalog'] })
  }

  const createUser = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      const roleIds = form.getAll('roleIds').map(String).filter(Boolean)
      return apiRequest('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          employeeNo: String(form.get('employeeNo') ?? '').trim(),
          firstName: String(form.get('firstName') ?? '').trim(),
          lastName: String(form.get('lastName') ?? '').trim(),
          email: String(form.get('email') ?? '').trim(),
          phone: String(form.get('phone') ?? '').trim() || undefined,
          specialisation: String(form.get('specialisation') ?? '').trim() || undefined,
          temporaryPassword: form.get('temporaryPassword'),
          ...(roleIds.length ? { roleIds } : {}),
        }),
      })
    },
    onSuccess: async () => {
      notify('User created', 'Staff account is ready for first login.', 'success')
      await invalidate()
    },
    onError: (error: Error) => {
      notify('Could not create user', accountActionError(error, 'Unable to create the account. Please try again.'), 'critical')
    },
  })

  const updateUser = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: Record<string, unknown>
    }) =>
      apiRequest(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: async (_data, variables) => {
      notify('User updated', 'Staff profile saved.', 'success')
      setEditingUser(null)
      await invalidate()
      if (variables.id === currentUser?.id && variables.payload.roleIds) {
        notify('Session ended', 'Your roles changed. Sign in again to continue.', 'warning')
        void endSession('user')
      }
    },
    onError: (error: Error) => {
      notify('Could not update user', accountActionError(error, 'Unable to save the account. Please try again.'), 'critical')
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
    onError: (error: Error) => {
      notify(
        'Could not reset password',
        accountActionError(error, 'Unable to reset the password. Please try again.'),
        'critical',
      )
    },
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
    onSuccess: async () => {
      notify('Department assigned', 'Staff department was saved.', 'success')
      await invalidate()
    },
    onError: (error: Error) => {
      notify(
        'Could not assign department',
        accountActionError(error, 'Unable to assign the department. Please try again.'),
        'critical',
      )
    },
  })

  const userAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'activate' | 'deactivate' | 'unlock' }) =>
      apiRequest(`/admin/users/${id}/${action}`, { method: 'POST' }),
    onSuccess: async (_data, variables) => {
      setActionErrorUserId(null)
      notify(
        variables.action === 'unlock'
          ? 'Account unlocked'
          : variables.action === 'activate'
            ? 'User activated'
            : 'User deactivated',
        variables.action === 'deactivate'
          ? 'The account is inactive and signed out.'
          : 'The account status was updated.',
        'success',
      )
      await invalidate()
    },
    onError: (error: Error) => {
      notify('Action failed', accountActionError(error, 'Unable to update the account. Please try again.'), 'critical')
    },
    onSettled: () => setPendingActionKey(null),
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

  const openEdit = (user: AdminUserItem) => {
    setEditingUser(user)
    setEditRoleIds(user.roles.filter((role) => assignableRoleIds.has(role.id)).map((role) => role.id))
    setResetPasswordUserId(null)
  }

  const submitUserEdit = (event: React.FormEvent<HTMLFormElement>, user: AdminUserItem) => {
    event.preventDefault()
    if (updateUser.isPending) return
    const form = new FormData(event.currentTarget)
    const targetIsSuperadmin = user.roles.some((role) => role.name === 'superadmin')
    const canEditRoles = !targetIsSuperadmin || currentIsSuperadmin
    const payload: Record<string, unknown> = {
      employeeNo: String(form.get('employeeNo') ?? '').trim(),
      firstName: String(form.get('firstName') ?? '').trim(),
      lastName: String(form.get('lastName') ?? '').trim(),
      email: String(form.get('email') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim() || undefined,
      specialisation: String(form.get('specialisation') ?? '').trim() || undefined,
    }
    if (canEditRoles) {
      if (!editRoleIds.length) {
        notify('Roles required', 'Keep at least one role. Empty role lists are not saved.', 'warning')
        return
      }
      const preservedHiddenRoles = user.roles
        .filter((role) => !assignableRoleIds.has(role.id))
        .map((role) => role.id)
      payload.roleIds = [...new Set([...preservedHiddenRoles, ...editRoleIds])]
      if (user.id === currentUser?.id) {
        const ok = window.confirm(
          'Changing your own roles will end this session. You will need to sign in again. Continue?',
        )
        if (!ok) return
      }
    }
    updateUser.mutate({ id: user.id, payload })
  }

  const runUserAction = (
    user: AdminUserItem,
    action: 'activate' | 'deactivate' | 'unlock',
  ) => {
    if (userAction.isPending) return
    if (action === 'deactivate' && user.id === currentUser?.id) {
      notify('Not allowed', 'You cannot deactivate your own account.', 'warning')
      return
    }
    const label = `${user.firstName} ${user.lastName}`
    const confirmed =
      action === 'deactivate'
        ? window.confirm(`Deactivate ${label}? They will be signed out and cannot use the system until reactivated.`)
        : action === 'activate'
          ? window.confirm(`Activate ${label}? They will be able to sign in again.`)
          : window.confirm(`Unlock ${label}? Failed-login lockout will be cleared.`)
    if (!confirmed) return
    setActionErrorUserId(user.id)
    setPendingActionKey(`${action}:${user.id}`)
    userAction.mutate({ id: user.id, action })
  }

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
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {summaryLoading && stat.label === 'Active users' ? '…' : stat.value}
              </p>
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
              onSubmit={(event) => {
                if (createUser.isPending) {
                  event.preventDefault()
                  return
                }
                submitFormMutation(createUser, event)
              }}
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
              {rolesLoading ? (
                <p className="text-sm text-slate-500">Loading roles...</p>
              ) : (
                <RoleChecklist
                  name="roleIds"
                  roles={roles}
                  selectedIds={addMode === 'doctor' && doctorRole ? [doctorRole.id] : []}
                />
              )}
              <Button type="submit" loading={createUser.isPending} disabled={createUser.isPending}>
                <UserPlus className="h-4 w-4" />
                {createUser.isPending
                  ? 'Saving…'
                  : addMode === 'doctor'
                    ? 'Create doctor account'
                    : 'Create user'}
              </Button>
            </form>
            {createUser.error ? (
              <Alert tone="error">{accountActionError(createUser.error, 'Unable to create the account.')}</Alert>
            ) : null}
          </Card>

          {canManageDepartments ? (
            <QuickAddForm
              title="Assign staff to department"
              pending={assignDepartment.isPending}
              error={
                assignDepartment.error
                  ? accountActionError(assignDepartment.error, 'Unable to assign the department.')
                  : null
              }
              onSubmit={(event) => {
                if (assignDepartment.isPending) {
                  event.preventDefault()
                  return
                }
                submitFormMutation(assignDepartment, event)
              }}
            >
              <p className="text-xs text-slate-500">
                Create or rename departments in Control Center → Departments &amp; clinics. This screen only assigns
                staff to those rows.
              </p>
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
          {usersLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading staff accounts...</p>
          ) : usersError ? (
            <div className="mt-4 space-y-3">
              <Alert tone="error">
                {usersQueryError instanceof Error ? usersQueryError.message : 'Unable to load staff accounts.'}
              </Alert>
              <Button type="button" variant="secondary" onClick={() => refetchUsers()}>
                Retry
              </Button>
            </div>
          ) : (
          <div className="mt-4 space-y-3">
            {filteredUsers.map((user) => {
              const targetIsSuperadmin = user.roles.some((role) => role.name === 'superadmin')
              const canEditRoles = !targetIsSuperadmin || currentIsSuperadmin
              const canMutateProtected = !targetIsSuperadmin || currentIsSuperadmin
              const isSelf = user.id === currentUser?.id
              const isLocked = Boolean(user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now())
              return (
              <div key={user.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">
                      {user.firstName} {user.lastName}
                      {isSelf ? <span className="ml-2 text-xs font-semibold text-teal-700">You</span> : null}
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
                  <div className="flex flex-wrap gap-1">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold ${
                        user.active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                    {isLocked ? (
                      <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-bold text-rose-800">
                        Locked
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => openEdit(user)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  {canMutateProtected ? (
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
                  ) : null}
                  {user.active ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-xs"
                      loading={pendingActionKey === `deactivate:${user.id}`}
                      disabled={userAction.isPending || isSelf || !canMutateProtected}
                      onClick={() => runUserAction(user, 'deactivate')}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-xs"
                      loading={pendingActionKey === `activate:${user.id}`}
                      disabled={userAction.isPending || !canMutateProtected}
                      onClick={() => runUserAction(user, 'activate')}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Activate
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-xs"
                    loading={pendingActionKey === `unlock:${user.id}`}
                    disabled={userAction.isPending || !canMutateProtected}
                    onClick={() => runUserAction(user, 'unlock')}
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
                {!canMutateProtected ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Protected superadmin account. Status, unlock, password, and role changes are reserved for a superadmin.
                  </p>
                ) : null}
                {userAction.error && actionErrorUserId === user.id ? (
                  <Alert tone="error" className="mt-3">
                    {accountActionError(userAction.error, 'Unable to update the account.')}
                  </Alert>
                ) : null}

                {editingUser?.id === user.id ? (
                  <form
                    className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                    onSubmit={(event) => submitUserEdit(event, user)}
                  >
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
                    {canEditRoles ? (
                      <RoleChecklist
                        name="roleIds"
                        roles={roles}
                        selectedIds={editRoleIds}
                        onChange={setEditRoleIds}
                      />
                    ) : (
                      <Alert tone="warning">
                        Only a superadmin can change roles on this protected account. Current roles stay{' '}
                        {user.roles.map((role) => role.label).join(', ')}.
                      </Alert>
                    )}
                    {isSelf ? (
                      <p className="text-xs text-amber-800">
                        This is your account. You cannot deactivate it here. Changing roles will sign you out.
                      </p>
                    ) : null}
                    <Button type="submit" loading={updateUser.isPending} disabled={updateUser.isPending} className="text-xs">
                      {updateUser.isPending ? 'Saving…' : 'Save changes'}
                    </Button>
                    {updateUser.error ? (
                      <Alert tone="error">
                        {accountActionError(updateUser.error, 'Unable to save the account.')}
                      </Alert>
                    ) : null}
                  </form>
                ) : null}

                {resetPasswordUserId === user.id ? (
                  <form
                    className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4"
                    onSubmit={(event) => {
                      if (resetPassword.isPending) {
                        event.preventDefault()
                        return
                      }
                      submitFormMutation(resetPassword, event, { resetOnSuccess: true })
                    }}
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
                      hint="Minimum 10 characters. User sessions will be signed out. The password is not stored in logs."
                      required
                    />
                    <Button type="submit" loading={resetPassword.isPending} disabled={resetPassword.isPending} variant="secondary" className="text-xs">
                      {resetPassword.isPending ? 'Saving…' : 'Reset password'}
                    </Button>
                    {resetPassword.error ? (
                      <Alert tone="error">
                        {accountActionError(resetPassword.error, 'Unable to reset the password.')}
                      </Alert>
                    ) : null}
                  </form>
                ) : null}
              </div>
              )
            })}
            {!filteredUsers.length ? (
              <p className="text-sm text-slate-500">No staff match your search.</p>
            ) : null}
          </div>
          )}
        </Card>
      </div>
    </div>
  )
}
