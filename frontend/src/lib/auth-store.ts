import { create } from 'zustand'

export interface UserProfile {
  id: string
  firstName: string
  lastName: string
  email: string
  roles: string[]
  permissions: string[]
  forcePasswordChange?: boolean
}

interface AuthState {
  tenant: string
  accessToken: string | null
  refreshToken: string | null
  user: UserProfile | null
  setTenant: (tenant: string) => void
  setSession: (session: {
    accessToken: string
    refreshToken?: string
    user?: UserProfile
  }) => void
  clearSession: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  tenant: localStorage.getItem('afyasasa.tenant') ?? 'demo',
  accessToken: localStorage.getItem('afyasasa.accessToken'),
  refreshToken: localStorage.getItem('afyasasa.refreshToken'),
  user: localStorage.getItem('afyasasa.user')
    ? JSON.parse(localStorage.getItem('afyasasa.user') as string)
    : null,
  setTenant: (tenant) => {
    localStorage.setItem('afyasasa.tenant', tenant)
    set({ tenant })
  },
  setSession: ({ accessToken, refreshToken, user }) => {
    localStorage.setItem('afyasasa.accessToken', accessToken)
    if (refreshToken) {
      localStorage.setItem('afyasasa.refreshToken', refreshToken)
    }
    if (user) {
      localStorage.setItem('afyasasa.user', JSON.stringify(user))
    }
    set((state) => ({
      accessToken,
      refreshToken: refreshToken ?? state.refreshToken,
      user: user ?? state.user,
    }))
  },
  clearSession: () => {
    localStorage.removeItem('afyasasa.accessToken')
    localStorage.removeItem('afyasasa.refreshToken')
    localStorage.removeItem('afyasasa.user')
    set({ accessToken: null, refreshToken: null, user: null })
  },
}))
