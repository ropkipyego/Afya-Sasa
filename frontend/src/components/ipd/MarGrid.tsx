import clsx from 'clsx'

export type MarEntry = {
  id: string
  medicationName: string
  dosage: string
  route: string
  frequency: string
  scheduledTime: string
  status: string
}

const timeSlots = ['08:00', '12:00', '16:00', '20:00']

function slotForTime(iso: string): string {
  const hour = new Date(iso).getHours()
  if (hour < 10) return '08:00'
  if (hour < 14) return '12:00'
  if (hour < 18) return '16:00'
  return '20:00'
}

const statusIcon: Record<string, string> = {
  given: '✓',
  scheduled: '○',
  withheld: '⊘',
  refused: '✗',
  not_available: '—',
}

const statusTone: Record<string, string> = {
  given: 'bg-emerald-100 text-emerald-800',
  scheduled: 'bg-slate-100 text-slate-500',
  withheld: 'bg-amber-100 text-amber-800',
  refused: 'bg-red-100 text-red-800',
  not_available: 'bg-slate-100 text-slate-400',
}

export function MarGrid({ entries }: { entries: MarEntry[] }) {
  const medications = Array.from(new Set(entries.map((e) => e.medicationName)))

  if (!medications.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 px-8 py-16 text-center">
        <p className="text-lg font-semibold text-slate-700">No medications on chart</p>
        <p className="mt-2 text-sm text-slate-500">Use Medication Order in clinical actions above.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 text-sm">
        {Object.entries(statusIcon).map(([status, icon]) => (
          <span key={status} className="inline-flex items-center gap-2 text-slate-600">
            <span className={clsx('inline-flex h-8 w-8 items-center justify-center rounded-lg font-bold', statusTone[status])}>
              {icon}
            </span>
            <span className="capitalize">{status.replace('_', ' ')}</span>
          </span>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
          <tr>
            <th className="px-6 py-4">Medication</th>
            {timeSlots.map((slot) => (
              <th key={slot} className="px-4 py-4 text-center">
                {slot}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {medications.map((med) => {
            const medEntries = entries.filter((e) => e.medicationName === med)
            const sample = medEntries[0]
            return (
              <tr key={med} className="hover:bg-slate-50/50">
                <td className="px-6 py-5">
                  <p className="font-semibold text-slate-900">{med}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {sample.dosage} · {sample.route} · {sample.frequency}
                  </p>
                </td>
                {timeSlots.map((slot) => {
                  const dose = medEntries.find((e) => slotForTime(e.scheduledTime) === slot)
                  return (
                    <td key={slot} className="px-3 py-3 text-center">
                      {dose ? (
                        <span
                          className={clsx(
                            'inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold',
                            statusTone[dose.status] ?? statusTone.scheduled,
                          )}
                          title={dose.status}
                        >
                          {statusIcon[dose.status] ?? '○'}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
}
