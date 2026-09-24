import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, Search } from 'lucide-react'
import { Alert, Button, Card, Field, Input, PageHeader } from '../../ui'
import { formDataFromElement, submitFormMutation } from '../../../lib/form-utils'
import { apiRequest } from '../../../lib/api'
import { notify } from '../../../lib/notify'
import { useAuthStore } from '../../../lib/auth-store'
import { groupPermissionsByResource, type PermissionRow } from '../../../lib/permission-categories'

const PROTECTED_SYSTEM_ROLES = new Set(['superadmin', 'administrator'])

type PermissionItem = PermissionRow
type RoleItem = {
  id: string
  name: string
  label: string
  description?: string
  permissions?: PermissionItem[]
}

export function RolesPermissionsPanel() {
  const queryClient = useQueryClient()
  const isSuperadmin = useAuthStore((state) => state.user?.roles.includes('superadmin') ?? false)
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [permissionSearch, setPermissionSearch] = useState('')
  const [draftPermissionIds, setDraftPermissionIds] = useState<string[]>([])
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const {
    data: roles = [],
    isLoading: rolesLoading,
    isError: rolesError,
    error: rolesQueryError,
    refetch: refetchRoles,
  } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => apiRequest<RoleItem[]>('/admin/roles'),
  })
  const { data: permissions = [] } = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: () => apiRequest<PermissionItem[]>('/admin/permissions'),
  })

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0]
  const selectedRoleLocked =
    Boolean(selectedRole) && PROTECTED_SYSTEM_ROLES.has(selectedRole!.name) && !isSuperadmin

  const filteredPermissions = useMemo(() => {
    const q = permissionSearch.trim().toLowerCase()
    if (!q) return permissions
    return permissions.filter(
      (p) =>
        p.permissionKey.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        (p.resource ?? '').toLowerCase().includes(q),
    )
  }, [permissions, permissionSearch])

  const grouped = useMemo(() => groupPermissionsByResource(filteredPermissions), [filteredPermissions])

  const activePermissionIds =
    draftPermissionIds.length > 0
      ? draftPermissionIds
      : (selectedRole?.permissions ?? []).map((p) => p.id)

  const createRole = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/admin/roles', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          label: form.get('label'),
          description: form.get('description'),
        }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      notify('Role created', 'Assign permissions in the table.', 'success')
    },
    onError: (error: Error) => notify('Could not create role', error.message, 'critical'),
  })

  const savePermissions = useMutation({
    mutationFn: () =>
      apiRequest(`/admin/roles/${selectedRole!.id}/permissions`, {
        method: 'PATCH',
        body: JSON.stringify({ permissionIds: activePermissionIds }),
      }),
    onSuccess: async () => {
      setDraftPermissionIds([])
      await queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      notify('Permissions saved', `${selectedRole?.label} updated.`, 'success')
    },
    onError: (error: Error) => notify('Could not save permissions', error.message, 'critical'),
  })

  const currentIds = () =>
    selectedRole
      ? draftPermissionIds.length
        ? draftPermissionIds
        : (selectedRole.permissions ?? []).map((p) => p.id)
      : []

  const togglePermission = (permissionId: string) => {
    const base = currentIds()
    setDraftPermissionIds(
      base.includes(permissionId) ? base.filter((id) => id !== permissionId) : [...base, permissionId],
    )
  }

  const setGroup = (ids: string[], granted: boolean) => {
    const base = new Set(currentIds())
    for (const id of ids) {
      if (granted) base.add(id)
      else base.delete(id)
    }
    setDraftPermissionIds([...base])
  }

  const cloneFromRole = (roleId: string) => {
    const source = roles.find((r) => r.id === roleId)
    if (!source) return
    setDraftPermissionIds((source.permissions ?? []).map((p) => p.id))
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[18rem_1fr]">
      <Card className="p-5">
        <PageHeader title="Roles" description="Pick a role, then grant department rights." />
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            if (createRole.isPending) {
              event.preventDefault()
              return
            }
            submitFormMutation(createRole, event)
          }}
        >
          <Field name="name" label="Role key" required placeholder="pharmacist" />
          <Field name="label" label="Display label" required placeholder="Pharmacist" />
          <Field name="description" label="Description" />
          <Button type="submit" loading={createRole.isPending} disabled={createRole.isPending}>
            Create role
          </Button>
        </form>
        {createRole.error ? <Alert tone="error" className="mt-3">{createRole.error.message}</Alert> : null}

        <div className="mt-6">
          {rolesLoading ? (
            <p className="text-sm text-slate-500">Loading roles…</p>
          ) : rolesError ? (
            <div className="space-y-3">
              <Alert tone="error">
                {rolesQueryError instanceof Error ? rolesQueryError.message : 'Unable to load roles.'}
              </Alert>
              <Button type="button" variant="secondary" onClick={() => refetchRoles()}>
                Retry
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {roles.map((role) => {
                const count = (role.permissions ?? []).length
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      setSelectedRoleId(role.id)
                      setDraftPermissionIds([])
                    }}
                    className={`w-full rounded-xl border p-3 text-left ${
                      selectedRole?.id === role.id
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-semibold">{role.label}</p>
                    <p className="text-xs text-slate-500">
                      {count} right{count === 1 ? '' : 's'} · {role.name}
                    </p>
                  </button>
                )
              })}
              {!roles.length ? <p className="text-sm text-slate-500">No roles configured yet.</p> : null}
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <PageHeader
          title={selectedRole ? `Rights — ${selectedRole.label}` : 'Rights'}
          description="Grouped by department. Grant a whole category or a single action."
        />

        {selectedRole ? (
          <>
            {selectedRoleLocked ? (
              <Alert tone="warning" className="mt-4">
                Only a platform superadmin can edit the {selectedRole.label} role.
              </Alert>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[12rem] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Search a department or right…"
                  value={permissionSearch}
                  onChange={(e) => setPermissionSearch(e.target.value)}
                />
              </div>
              <select
                className="input text-sm"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) cloneFromRole(e.target.value)
                  e.target.value = ''
                }}
              >
                <option value="">Copy from another role…</option>
                {roles
                  .filter((r) => r.id !== selectedRole.id)
                  .map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.label}
                    </option>
                  ))}
              </select>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              {activePermissionIds.length} of {permissions.length} rights granted
              {permissionSearch ? ` · showing ${filteredPermissions.length} matches` : ''}
            </p>

            <div className="mt-4 space-y-3">
              {grouped.map((group) => {
                const ids = group.permissions.map((p) => p.id)
                const granted = ids.filter((id) => activePermissionIds.includes(id)).length
                const open = openGroups[group.resource] ?? true
                return (
                  <section key={group.resource} className="overflow-hidden rounded-xl border border-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() =>
                          setOpenGroups((current) => ({ ...current, [group.resource]: !open }))
                        }
                      >
                        <p className="text-sm font-semibold text-slate-900">{group.label}</p>
                        <p className="text-xs text-slate-500">
                          {granted}/{ids.length} granted
                        </p>
                      </button>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-3 py-1 text-xs"
                          disabled={selectedRoleLocked}
                          onClick={() => setGroup(ids, true)}
                        >
                          All
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-3 py-1 text-xs"
                          disabled={selectedRoleLocked}
                          onClick={() => setGroup(ids, false)}
                        >
                          None
                        </Button>
                      </div>
                    </div>
                    {open ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                              <th className="w-16 px-4 py-2">Grant</th>
                              <th className="px-4 py-2">Right</th>
                              <th className="px-4 py-2">What it allows</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.permissions.map((permission) => {
                              const checked = activePermissionIds.includes(permission.id)
                              return (
                                <tr key={permission.id} className="border-b border-slate-100 last:border-0">
                                  <td className="px-4 py-2">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 rounded border-slate-300 text-teal-600"
                                      checked={checked}
                                      disabled={selectedRoleLocked}
                                      onChange={() => togglePermission(permission.id)}
                                      aria-label={permission.permissionKey}
                                    />
                                  </td>
                                  <td className="px-4 py-2 font-mono text-xs text-slate-700">
                                    {permission.permissionKey}
                                  </td>
                                  <td className="px-4 py-2 text-slate-600">
                                    {permission.description || permission.action || '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </section>
                )
              })}
              {!grouped.length ? (
                <p className="py-8 text-center text-sm text-slate-500">No rights match that search.</p>
              ) : null}
            </div>

            <Button
              type="button"
              className="mt-4"
              loading={savePermissions.isPending}
              disabled={selectedRoleLocked || savePermissions.isPending}
              onClick={() => savePermissions.mutate()}
            >
              <Save className="h-4 w-4" />
              Save rights
            </Button>
            {savePermissions.error ? <Alert tone="error">{savePermissions.error.message}</Alert> : null}
          </>
        ) : (
          <p className="mt-6 text-sm text-slate-500">Create or select a role first.</p>
        )}
      </Card>
    </div>
  )
}
