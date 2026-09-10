import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Activity, Building2, ChevronDown, Hospital } from 'lucide-react'
import { PasswordInput } from '../ui'
import { apiRequest } from '../../lib/api'
import { fetchPublicHospitals, type PublicHospital } from '../../lib/public-api'
import { useAuthStore } from '../../lib/auth-store'
import { DEFAULT_TENANT, HIDE_TENANT_SELECTOR } from '../../lib/tenant-config'

type LoginScreenProps = {
  tenant: string
  setTenant: (tenant: string) => void
}

function HospitalIdentityCard({ hospital }: { hospital: PublicHospital }) {
  const accent = hospital.primaryColor ?? '#0d9488'
  return (
    <div
      className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5"
      style={{ borderTopColor: accent, borderTopWidth: 3 }}
    >
      <div className="flex items-center gap-4">
        {hospital.logoUrl ? (
          <img
            src={hospital.logoUrl}
            alt=""
            className="h-14 w-14 rounded-xl border border-slate-200 bg-white object-contain p-1"
          />
        ) : (
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ background: `linear-gradient(135deg, ${accent}, #0f172a)` }}
          >
            <Hospital className="h-7 w-7" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-slate-900">{hospital.name}</h2>
          {hospital.tagline ? (
            <p className="mt-0.5 text-sm text-slate-600">{hospital.tagline}</p>
          ) : null}
          {hospital.address ? (
            <p className="mt-1 text-xs text-slate-500">{hospital.address}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function LoginScreen({ tenant, setTenant }: LoginScreenProps) {
  const initialResetToken =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('resetToken')
      : null
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>(initialResetToken ? 'reset' : 'login')
  const [resetToken, setResetToken] = useState(initialResetToken ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [info, setInfo] = useState<string | null>(null)
  const setSession = useAuthStore((state) => state.setSession)

  const { data: hospitals = [], isLoading: hospitalsLoading } = useQuery({
    queryKey: ['public-hospitals'],
    queryFn: () => fetchPublicHospitals(DEFAULT_TENANT),
    staleTime: 60_000,
  })

  useEffect(() => {
    if (HIDE_TENANT_SELECTOR && tenant !== DEFAULT_TENANT) {
      setTenant(DEFAULT_TENANT)
    }
  }, [tenant, setTenant])

  useEffect(() => {
    if (!hospitals.length) return
    const exists = hospitals.some((h) => h.code === tenant)
    if (!exists) {
      const preferred = hospitals.find((h) => h.code === DEFAULT_TENANT) ?? hospitals[0]
      setTenant(preferred.code)
    }
  }, [hospitals, tenant, setTenant])

  const selectedHospital = useMemo(
    () => hospitals.find((h) => h.code === tenant) ?? null,
    [hospitals, tenant],
  )

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest<{
        accessToken: string
        refreshToken: string
        user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, device: 'web' }),
      })
      setSession(result)
    },
  })

  const forgotMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest<{ message: string; resetToken?: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      if (import.meta.env.DEV && result.resetToken) {
        setInfo(`${result.message} Dev token: ${result.resetToken}`)
      } else {
        setInfo(result.message)
      }
    },
  })

  const resetMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, newPassword }),
      })
      setInfo('Password updated. Sign in with your new password.')
      setMode('login')
      setPassword('')
      setNewPassword('')
    },
  })

  const error =
    mutation.error?.message ?? forgotMutation.error?.message ?? resetMutation.error?.message ?? null

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10 sm:max-w-lg sm:px-6">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-teal-900 text-white shadow-lg shadow-teal-900/20">
            <Activity className="h-6 w-6" strokeWidth={2.25} />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-teal-700">AfyaSasa</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Clinical EMR</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
            One patient. One chart. From the front desk to the ward — the visit never loses the person.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
          {mode === 'login' && selectedHospital && HIDE_TENANT_SELECTOR ? (
            <div className="mb-6">
              <HospitalIdentityCard hospital={selectedHospital} />
            </div>
          ) : null}

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (mode === 'forgot') {
                forgotMutation.mutate()
                return
              }
              if (mode === 'reset') {
                resetMutation.mutate()
                return
              }
              mutation.mutate()
            }}
          >
            {mode === 'reset' ? (
              <>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Reset token</span>
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    value={resetToken}
                    onChange={(event) => setResetToken(event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">New password</span>
                  <div className="mt-1.5">
                    <PasswordInput
                      className="rounded-xl border-slate-300 px-4 py-3"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                </label>
              </>
            ) : (
              <>
                {!HIDE_TENANT_SELECTOR && mode === 'login' ? (
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Hospital</span>
                    <div className="relative mt-1.5">
                      <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <select
                        className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-10 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        value={tenant}
                        disabled={hospitalsLoading}
                        onChange={(event) => setTenant(event.target.value)}
                      >
                        {hospitals.map((hospital) => (
                          <option key={hospital.code} value={hospital.code}>
                            {hospital.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                  </label>
                ) : null}

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Email</span>
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    type="email"
                    autoComplete="username"
                    placeholder="you@hospital.co.ke"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </label>

                {mode === 'login' ? (
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Password</span>
                    <div className="mt-1.5">
                      <PasswordInput
                        className="rounded-xl border-slate-300 px-4 py-3"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                      />
                    </div>
                  </label>
                ) : null}
              </>
            )}

            {info ? (
              <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-100">{info}</p>
            ) : null}
            {error ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-100">{error}</p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60"
              disabled={mutation.isPending || forgotMutation.isPending || resetMutation.isPending}
            >
              {mode === 'forgot'
                ? forgotMutation.isPending
                  ? 'Sending…'
                  : 'Send reset link'
                : mode === 'reset'
                  ? resetMutation.isPending
                    ? 'Updating…'
                    : 'Set new password'
                  : mutation.isPending
                    ? 'Signing in…'
                    : 'Sign in'}
            </button>
          </form>

          <div className="mt-4 text-center text-sm">
            {mode === 'login' ? (
              <button
                type="button"
                className="font-medium text-teal-700 hover:underline"
                onClick={() => {
                  setMode('forgot')
                  setInfo(null)
                }}
              >
                Forgot password?
              </button>
            ) : (
              <button
                type="button"
                className="font-medium text-teal-700 hover:underline"
                onClick={() => {
                  setMode('login')
                  setInfo(null)
                }}
              >
                Back to sign in
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Authorised staff only
        </p>
      </div>
    </div>
  )
}
