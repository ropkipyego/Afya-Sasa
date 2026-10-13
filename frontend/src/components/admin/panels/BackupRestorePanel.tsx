import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, PageHeader } from '../../ui'
import { apiRequest, formatApiError } from '../../../lib/api'

type BackupInventory = {
  fullSystemBackup: boolean
  productionRestoreAllowedFromUi: boolean
  components: Array<{ id: string; required: boolean; includedByScript: string | null; note: string }>
  scriptStillAvailable: string[]
  archives: { directory: string | null; items: Array<{ filename: string; sizeBytes: number; modifiedAt: string; verified: boolean }> }
}

export function BackupRestorePanel() {
  const { data, isError, error, refetch } = useQuery({
    queryKey: ['admin-backups'],
    queryFn: () => apiRequest<BackupInventory>('/admin/backups'),
  })

  const refuseRestore = async () => {
    try {
      await apiRequest('/admin/backups/restore', { method: 'POST' })
    } catch (caught) {
      window.alert(formatApiError(caught, 'Restore is blocked from this screen.'))
    }
  }

  return (
    <Card className="p-8">
      <PageHeader
        title="Backup & restore"
        description="Guided inventory of what a hospital recovery actually needs. A SQL dump is not a full-system backup."
      />
      <Alert tone="warning" className="mt-6">
        This UI will not overwrite the live hospital database. Production restore remains a separate authorised procedure.
      </Alert>
      {isError ? (
        <Alert tone="error" className="mt-4">
          {formatApiError(error, 'Could not load backup inventory.')}
        </Alert>
      ) : null}
      <div className="mt-6 space-y-4 text-sm">
        {(data?.components ?? []).map((component) => (
          <section key={component.id} className="rounded-2xl border border-slate-200 p-5">
            <p className="font-bold capitalize">{component.id}</p>
            <p className="mt-1 text-slate-600">{component.note}</p>
            <p className="mt-2 text-xs text-slate-500">
              Script: {component.includedByScript ?? 'not included in postgres dump'} · required: {component.required ? 'yes' : 'no'}
            </p>
          </section>
        ))}
        <section className="rounded-2xl border border-slate-200 p-5">
          <p className="font-bold">Available SQL archives (local folder)</p>
          <p className="mt-1 text-xs text-slate-500">{data?.archives.directory ?? 'No backups directory found'}</p>
          <ul className="mt-3 space-y-2">
            {(data?.archives.items ?? []).map((item) => (
              <li key={item.filename} className="rounded-xl bg-slate-50 px-3 py-2">
                {item.filename} · {(item.sizeBytes / 1024).toFixed(1)} KB · {item.modifiedAt} · verified: no
              </li>
            ))}
            {!data?.archives.items.length ? <li className="text-slate-500">No SQL archives listed.</li> : null}
          </ul>
        </section>
        <p className="text-xs text-slate-500">
          Underlying scripts remain: {(data?.scriptStillAvailable ?? []).join(', ')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => refetch()}>
            Refresh inventory
          </Button>
          <Button type="button" variant="ghost" onClick={() => void refuseRestore()}>
            Attempt restore (blocked)
          </Button>
        </div>
      </div>
    </Card>
  )
}
