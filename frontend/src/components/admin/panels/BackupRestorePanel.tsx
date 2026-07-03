import { Card, PageHeader } from '../../ui'

export function BackupRestorePanel() {
  return (
    <Card className="p-8">
      <PageHeader
        title="Backup & restore"
        description="Protect hospital data with regular PostgreSQL backups."
      />
      <div className="mt-8 space-y-6 text-sm text-slate-700">
        <section className="rounded-2xl border border-slate-200 p-5">
          <p className="font-bold">Create backup</p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">
            npm run db:backup
          </pre>
          <p className="mt-2 text-slate-500">Writes a SQL dump under the project backups folder.</p>
        </section>
        <section className="rounded-2xl border border-slate-200 p-5">
          <p className="font-bold">Restore backup</p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">
            npm run db:restore -- backups/your-backup.sql
          </pre>
        </section>
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <p className="font-bold">Full environment reset</p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">
            docker compose down -v{'\n'}docker compose up -d --build
          </pre>
          <p className="mt-2">Deletes all Docker volumes including database and file storage.</p>
        </section>
      </div>
    </Card>
  )
}
