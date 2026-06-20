import { useAuthStore } from './auth-store'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const { tenant, accessToken, refreshToken, setSession, clearSession } =
    useAuthStore.getState()
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('X-Tenant', tenant)

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (response.status === 401 && retry && refreshToken) {
    const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant': tenant,
      },
      body: JSON.stringify({ refreshToken }),
    })

    if (refreshResponse.ok) {
      const refreshed = await refreshResponse.json()
      setSession({ accessToken: refreshed.accessToken })
      return apiRequest<T>(path, options, false)
    }

    clearSession()
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: response.statusText,
    }))
    throw new Error(error.message ?? error.error?.message ?? 'Request failed')
  }

  return response.json() as Promise<T>
}
