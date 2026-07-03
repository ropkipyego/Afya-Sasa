import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Save, Search } from 'lucide-react'
import { Alert, Button, Card, Field, Input, PageHeader } from '../../ui'
import { formDataFromElement } from '../../../lib/form-utils'
import { apiRequest } from '../../../lib/api'
import { notify } from '../../../lib/notify'

type PermissionItem = { id: string; permissionKey: string; description?: string }
type RoleItem = {
  id: string
  name: string
  label: string
  description?: string
  permissions?: PermissionItem[]
}

export function RolesPermissionsPanel() {
  const queryClient = useQueryClient()
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')
  const [permissionSearch, setPermissionSearch] = useState('')
  const [draftPermissionIds, setDraftPermissionIds] = useState<string[]>([])

  const { data: roles = [] } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => apiRequest<RoleItem[]>('/admin/roles'),
  })
  const { data: permissions = [] } = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: () => apiRequest<PermissionItem[]>('/admin/permissions'),
  })

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0]

  const filteredPermissions = useMemo(() => {
    const q = permissionSearch.trim().toLowerCase()
    if (!q) return permissions
    return permissions.filter(
      (p) =>
        p.permissionKey.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q),
    )
  }, [permissions, permissionSearch])

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
      notify('Role created', 'Assign permissions below.', 'success')
    },
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
  })

  const togglePermission = (permissionId: string) => {
    const base = selectedRole
      ? draftPermissionIds.length
        ? draftPermissionIds
        : (selectedRole.permissions ?? []).map((p) => p.id)
      : []
    setDraftPermissionIds(
      base.includes(permissionId)
        ? base.filter((id) => id !== permissionId)
        : [...base, permissionId],
    )
  }

  const selectAll = () => setDraftPermissionIds(filteredPermissions.map((p) => p.id))
  const clearAll = () => setDraftPermissionIds([])

  const cloneFromRole = (roleId: string) => {
    const source = roles.find((r) => r.id === roleId)
    if (!source) return
    setDraftPermissionIds((source.permissions ?? []).map((p) => p.id))
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <Card className="p-6">
        <PageHeader title="Create role" description="Permission bundles for hospital staff." />
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            createRole.mutate(event.currentTarget)
            event.currentTarget.reset()
          }}
        >
          <Field name="name" label="Role key" required placeholder="senior_lab_officer" />
          <Field name="label" label="Display label" required placeholder="Senior laboratory officer" />
          <Field name="description" label="Description" />
          <Button type="submit" loading={createRole.isPending}>
            Create role
          </Button>
        </form>

        <div className="mt-8">
          <h4 className="font-bold">Existing roles</h4>
          <div className="mt-3 space-y-2">
            {roles.map((role) => (
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
                  {(role.permissions ?? []).length} permissions · {role.name}
                </p>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <PageHeader
          title={selectedRole ? `Permissions — ${selectedRole.label}` : 'Permissions'}
          description="Granular access control — search, select all, or clone from another role."
        />

        {selectedRole ? (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Search permissions…"
                  value={permissionSearch}
                  onChange={(e) => setPermissionSearch(e.target.value)}
                />
              </div>
              <Button type="button" variant="secondary" className="text-xs" onClick={selectAll}>
                Select all
              </Button>
              <Button type="button" variant="ghost" className="text-xs" onClick={clearAll}>
                Clear all
              </Button>
              <select
                className="input text-xs"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) cloneFromRole(e.target.value)
                  e.target.value = ''
                }}
              >
                <option value="">Clone from role…</option>
                {roles
                  .filter((r) => r.id !== selectedRole.id)
                  .map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.label}
                    </option>
                  ))}
              </select>
            </div>

            <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">
              {filteredPermissions.map((permission) => {
                const checked = activePermissionIds.includes(permission.id)
                return (
                  <label
                    key={permission.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked}
                      onChange={() => togglePermission(permission.id)}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">
                        {permission.permissionKey}
                      </span>
                      {permission.description ? (
                        <span className="block text-xs text-slate-500">{permission.description}</span>
                      ) : null}
                    </span>
                  </label>
                )
              })}
            </div>

            <Button
              type="button"
              className="mt-4"
              loading={savePermissions.isPending}
              onClick={() => savePermissions.mutate()}
            >
              <Save className="h-4 w-4" />
              Save permissions
            </Button>
            {savePermissions.error ? <Alert tone="error">{savePermissions.error.message}</Alert> : null}
          </>
        ) : (
          <p className="mt-6 text-sm text-slate-500">Create or select a role to edit permissions.</p>
        )}

        <details className="mt-6 rounded-xl bg-slate-50 p-4">
          <summary className="cursor-pointer font-semibold">
            <Copy className="mr-2 inline h-4 w-4" />
            Role guidelines reference
          </summary>
          <p className="mt-2 text-sm text-slate-600">
            See Security panel for clinical role boundaries (reception, triage, doctor, lab, radiology).
          </p>
        </details>
      </Card>
    </div>
  )
}
