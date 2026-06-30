import { useMemo } from 'react'

type PartographPoint = {
  id: string
  recordedAt: string
  cervicalDilationCm: string | null
  fetalHeartRate: number | null
  alertFlag: boolean
}

export function PartographChart({ entries }: { entries: PartographPoint[] }) {
  const sorted = useMemo(
    () => [...entries].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()),
    [entries],
  )

  if (!sorted.length) {
    return <p className="text-sm text-slate-500">No partograph data yet — add entries to see labour progress.</p>
  }

  const maxDilation = 10

  return (
    <div className="rounded-2xl border border-pink-200 bg-white p-4 md:p-6">
      <p className="text-xs font-bold uppercase text-slate-500">Cervical dilatation trend</p>
      <div className="mt-4 flex h-48 items-end gap-2 border-b border-l border-slate-200 pl-6 pb-6">
        {sorted.map((point) => {
          const cm = Number(point.cervicalDilationCm ?? 0)
          const height = Math.min(100, Math.max(8, (cm / maxDilation) * 100))
          return (
            <div key={point.id} className="flex flex-1 flex-col items-center gap-2">
              <div
                className={`w-full max-w-[2.5rem] rounded-t-lg ${point.alertFlag ? 'bg-amber-500' : 'bg-pink-500'}`}
                style={{ height: `${height}%` }}
                title={`${cm} cm · FHR ${point.fetalHeartRate ?? '—'}`}
              />
              <span className="text-[10px] font-medium text-slate-500">
                {new Date(point.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
        {sorted.map((p) => (
          <span key={p.id}>
            {new Date(p.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {p.cervicalDilationCm ?? '?'}cm · FHR {p.fetalHeartRate ?? '—'}
          </span>
        ))}
      </div>
    </div>
  )
}
