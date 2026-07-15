import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus } from 'lucide-react'
import { Button, Card, Field, PageHeader } from '../../ui'
import { apiRequest } from '../../../lib/api'
import { notify } from '../../../lib/notify'
import { useAuthStore } from '../../../lib/auth-store'
import { formDataFromElement, submitFormMutation } from '../../../lib/form-utils'

type TenantRow = {
  id: string
  name: string
  code: string
  schemaName: string
  subdomain: string
  active: boolean
  createdAt: string
}

export function SuperAdminPanel() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const canManageTenants = user?.permissions.includes('platform:tenants') === true
  const [showProvision, setShowProvision] = useState(false)

  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: () =>
      apiRequest<{
        database: string
        redis: string
        storage: string
        queue: string
        activeUsers: number
        lockedUsers: number
        timestamp: string
        tenant: { name: string; code: string } | null
      }>('/admin/system-health'),
  })

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['platform-tenants'],
    queryFn: () => apiRequest<TenantRow[]>('/platform/tenants'),
    enabled: canManageTenants,
  })

  const provision = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest<{ tenant: TenantRow; adminUser: { email: string } }>(
        '/platform/tenants/provision',
        {
          method: 'POST',
          body: JSON.stringify({
            name: form.get('name'),
            code: form.get('code'),
            subdomain: form.get('subdomain') || undefined,
            mohFacilityCode: form.get('mohFacilityCode') || undefined,
            adminFirstName: form.get('adminFirstName'),
            adminLastName: form.get('adminLastName'),
            adminEmail: form.get('adminEmail'),
            adminPassword: form.get('adminPassword'),
          }),
        },
      )
    },
    onSuccess: (result) => {
      notify('Tenant provisioned', `${result.tenant.name} — admin ${result.adminUser.email}`, 'success')
      setShowProvision(false)
      void queryClient.invalidateQueries({ queryKey: ['platform-tenants'] })
    },
    onError: (error: Error) => notify('Provision failed', error.message, 'critical'),
  })

  const toggleTenant = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest<TenantRow>(`/platform/tenants/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['platform-tenants'] }),
    onError: (error: Error) => notify('Update failed', error.message, 'critical'),
  })

  const opsCommands = [
    { label: 'Preflight check', command: 'npm run preflight' },
    { label: 'Smoke test', command: 'npm run smoke' },
    { label: 'Backup database', command: './ops/backup-postgres.sh' },
    { label: 'Restore database', command: './ops/restore-postgres.sh <backup-file>' },
    { label: 'OPD workflow test', command: './ops/opd-workflow-test.sh' },
    { label: 'IPD workflow test', command: './ops/ipd-workflow-test.sh' },
    { label: 'Full onboarding tests', command: './ops/run-onboarding-tests.sh' },
  ]

  return (
    <div className="space-y-6">
      <Card className="p-8">
        <PageHeader
          title="Super admin tools"
          description="Operations commands, health status, and deployment checks."
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Metric label="Active users" value={health?.activeUsers ?? 0} />
          <Metric label="Locked users" value={health?.lockedUsers ?? 0} />
          <Metric label="Tenant" value={health?.tenant?.code ?? '—'} />
        </div>
        <p className="mt-4 text-xs text-slate-500">Last check: {health?.timestamp ? new Date(health.timestamp).toLocaleString() : '—'}</p>
      </Card>

      {canManageTenants ? (
        <Card className="p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <PageHeader
              title="Hospital tenants"
              description="Provision isolated PostgreSQL schemas and admin accounts for new hospitals."
            />
            <Button type="button" onClick={() => setShowProvision((v) => !v)}>
              <Plus className="mr-2 h-4 w-4" />
              {showProvision ? 'Cancel' : 'Provision tenant'}
            </Button>
          </div>

          {showProvision ? (
            <form
              className="mt-6 grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => submitFormMutation(provision, event, { resetOnSuccess: true })}
            >
              <Field name="name" label="Hospital name" required />
              <Field name="code" label="Tenant code" hint="e.g. knh" required />
              <Field name="subdomain" label="Subdomain (optional)" />
              <Field name="mohFacilityCode" label="MOH facility code" />
              <Field name="adminFirstName" label="Admin first name" required />
              <Field name="adminLastName" label="Admin last name" required />
              <Field name="adminEmail" label="Admin email" type="email" required />
              <Field name="adminPassword" label="Temporary password" type="password" required />
              <div className="sm:col-span-2">
                <Button type="submit" loading={provision.isPending}>
                  <Building2 className="mr-2 h-4 w-4" />
                  Create tenant schema
                </Button>
              </div>
            </form>
          ) : null}

          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
            {tenantsLoading ? (
              <p className="p-6 text-sm text-slate-500">Loading tenants…</p>
            ) : tenants.length ? (
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Hospital</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Schema</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tenants.map((tenant) => (
                    <tr key={tenant.id}>
                      <td className="px-4 py-3 font-medium">{tenant.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{tenant.code}</td>
                      <td className="px-4 py-3 font-mono text-xs">{tenant.schemaName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            tenant.active
                              ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800'
                              : 'rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600'
                          }
                        >
                          {tenant.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {tenant.code !== 'demo' ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="text-xs"
                            loading={toggleTenant.isPending}
                            onClick={() =>
                              toggleTenant.mutate({ id: tenant.id, active: !tenant.active })
                            }
                          >
                            {tenant.active ? 'Deactivate' : 'Activate'}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="p-6 text-sm text-slate-500">No tenants registered yet.</p>
            )}
          </div>
        </Card>
      ) : null}

      <Card className="p-8">
        <PageHeader title="Operations scripts" description="Run from project root on the server." />
        <ul className="mt-6 space-y-3">
          {opsCommands.map((item) => (
            <li key={item.command} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold">{item.label}</p>
              <code className="mt-1 block text-xs text-slate-600">{item.command}</code>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-8">
        <PageHeader title="Production checklist" />
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-slate-600">
          <li>Set strong secrets in <code>.env</code> (JWT, Postgres, MinIO)</li>
          <li>Configure <code>SMS_PROVIDER=celcom_africa</code> with Celcom credentials for live SMS</li>
          <li>Run migrations on deploy: <code>TYPEORM_MIGRATIONS_RUN=true</code></li>
          <li>Restrict Swagger (<code>/docs</code>) behind admin VPN or disable in production</li>
          <li>Complete <code>docs/go-live-checklist.md</code> before go-live</li>
        </ul>
      </Card>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  )
}
