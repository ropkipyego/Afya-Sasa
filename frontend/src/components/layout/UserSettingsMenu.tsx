import { useEffect, useRef, useState } from 'react'
import { Settings, Volume2, VolumeX } from 'lucide-react'
import { getUserPreferences, setUserPreferences } from '../../lib/user-preferences'

export function UserSettingsMenu() {
  const [open, setOpen] = useState(false)
  const [sounds, setSounds] = useState(() => getUserPreferences().notificationSounds)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sync = () => setSounds(getUserPreferences().notificationSounds)
    window.addEventListener('afyasasa-preferences-changed', sync)
    return () => window.removeEventListener('afyasasa-preferences-changed', sync)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="User settings"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
      >
        <Settings className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <p className="px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            My settings
          </p>
          <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-slate-50">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
              {sounds ? <Volume2 className="h-4 w-4 text-teal-600" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
              Notification sounds
            </span>
            <input
              type="checkbox"
              checked={sounds}
              onChange={(event) => {
                const next = setUserPreferences({ notificationSounds: event.target.checked })
                setSounds(next.notificationSounds)
              }}
              className="h-4 w-4 rounded border-slate-300 text-teal-600"
            />
          </label>
        </div>
      ) : null}
    </div>
  )
}
