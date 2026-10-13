import { useEffect, useRef, useState } from 'react'
import { KeyRound, Settings, Volume2, VolumeX } from 'lucide-react'
import { apiRequest, formatApiError } from '../../lib/api'
import { useAuthStore } from '../../lib/auth-store'
import { getUserPreferences, setUserPreferences } from '../../lib/user-preferences'
import { PasswordInput } from '../ui'

export function UserSettingsMenu() {
  const setSession = useAuthStore((state) => state.setSession)
  const [open, setOpen] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
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

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match')
      return
    }
    setPending(true)
    try {
      const result = await apiRequest<{
        changed: boolean
        accessToken: string
        refreshToken: string
        user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>
      }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })
      setSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: { ...result.user, forcePasswordChange: false },
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setChangingPassword(false)
      setSuccess('Password updated. You can continue working.')
    } catch (caught) {
      setError(formatApiError(caught, 'Could not change password'))
    } finally {
      setPending(false)
    }
  }

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
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
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
          <button
            type="button"
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setChangingPassword((value) => !value)
              setError(null)
              setSuccess(null)
            }}
          >
            <KeyRound className="h-4 w-4 text-teal-600" />
            Change password
          </button>
          {success ? (
            <p className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{success}</p>
          ) : null}
          {changingPassword ? (
            <form className="mt-2 space-y-2 border-t border-slate-100 px-1 pt-3" onSubmit={(event) => void submitPassword(event)}>
              <PasswordInput
                required
                placeholder="Current password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
              <PasswordInput
                required
                placeholder="New password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <PasswordInput
                required
                placeholder="Confirm new password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending ? 'Updating…' : 'Update password'}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
