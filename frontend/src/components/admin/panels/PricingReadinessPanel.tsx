import { useEffect, useState } from 'react'
import { Plus, Save, Wallet } from 'lucide-react'
import { Alert, Button, Card, Field, PageHeader } from '../../ui'
import { useHospitalConfiguration } from '../../../hooks/useHospitalConfiguration'
import { usePricingScaffold } from '../../../hooks/usePricingScaffold'
import { notify } from '../../../lib/notify'
import { useAuthStore } from '../../../lib/auth-store'

type PricingItem = { code: string; name: string; category: string; active: boolean }

export function PricingReadinessPanel() {
  const { user } = useAuthStore()
  const { catalog, saveCatalog } = useHospitalConfiguration()
  const { data: scaffoldData } = usePricingScaffold()
  const isDirector =
    user?.roles.includes('administrator') ||
    user?.roles.includes('superadmin') ||
    user?.permissions.includes('settings:manage')

  const [enabled, setEnabled] = useState(catalog.servicePricingScaffold?.enabled ?? false)
  const [items, setItems] = useState<PricingItem[]>(catalog.servicePricingScaffold?.items ?? [])
  const [draft, setDraft] = useState({ code: '', name: '', category: 'consultation' })

  useEffect(() => {
    if (scaffoldData) {
      setEnabled(scaffoldData.enabled)
      setItems(scaffoldData.items)
    }
  }, [scaffoldData])

  if (!isDirector) {
    return (
      <Card className="p-8">
        <PageHeader
          title="Service pricing (directors only)"
          description="Pricing configuration is restricted to hospital directors. Amounts are not shown in clinical workflows yet."
        />
        <Alert tone="info" className="mt-6">
          You do not have access to configure pricing. Contact your hospital director or administrator.
        </Alert>
      </Card>
    )
  }

  const addItem = () => {
    const code = draft.code.trim()
    const name = draft.name.trim()
    if (!code || !name) return
    setItems((current) => [...current, { code, name, category: draft.category, active: true }])
    setDraft({ code: '', name: '', category: draft.category })
  }

  const save = async () => {
    try {
      await saveCatalog.mutateAsync({
        servicePricingScaffold: { enabled, items },
      })
      notify('Pricing scaffold saved', 'Service codes are ready — amounts will be added in a future release.', 'success')
    } catch (error) {
      notify('Save failed', (error as Error).message, 'critical')
    }
  }

  return (
    <Card className="p-8">
      <PageHeader
        title="Service pricing readiness"
        description="Prepare billable service codes for future money-flow reporting. No amounts are displayed to staff yet."
      />

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <Wallet className="mb-2 inline h-4 w-4" /> Director-only area. Price amounts will be configured later; this
        panel only defines service structure.
      </div>

      <label className="mt-6 flex items-center gap-3 text-sm font-semibold text-slate-800">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Enable pricing scaffold (hidden from clinical users)
      </label>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Field
          name="code"
          label="Service code"
          value={draft.code}
          onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
          placeholder="e.g. OPD-CONSULT"
        />
        <Field
          name="name"
          label="Service name"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="e.g. OPD consultation"
        />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Category</span>
          <select
            className="input w-full"
            value={draft.category}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
          >
            <option value="consultation">Consultation</option>
            <option value="procedure">Procedure</option>
            <option value="investigation">Investigation</option>
            <option value="admission">Admission</option>
            <option value="pharmacy">Pharmacy</option>
          </select>
        </label>
      </div>
      <Button type="button" variant="secondary" className="mt-4" onClick={addItem}>
        <Plus className="h-4 w-4" />
        Add service
      </Button>

      <div className="mt-6 space-y-2">
        {items.map((item) => (
          <div key={item.code} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
            <div>
              <p className="font-semibold">{item.name}</p>
              <p className="text-xs text-slate-500">
                {item.code} · {item.category} · amount: pending
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="text-xs"
              onClick={() =>
                setItems((current) =>
                  current.map((row) => (row.code === item.code ? { ...row, active: !row.active } : row)),
                )
              }
            >
              {item.active ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        ))}
        {!items.length ? <p className="text-sm text-slate-500">No services defined yet.</p> : null}
      </div>

      <Button type="button" className="mt-8" loading={saveCatalog.isPending} onClick={() => void save()}>
        <Save className="h-4 w-4" />
        Save pricing scaffold
      </Button>
    </Card>
  )
}
