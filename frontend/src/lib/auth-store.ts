import { create } from 'zustand'
import { DEFAULT_TENANT } from './tenant-config'

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
  hydrated: boolean
  setTenant: (tenant: string) => void
  setHydrated: (hydrated: boolean) => void
  setSession: (session: {
    accessToken: string
    refreshToken?: string
    user?: UserProfile
  }) => void
  setUser: (user: UserProfile) => void
  syncFromStorage: () => void
  clearSession: () => void
}

function readStorage(key: string) {
  return localStorage.getItem(key)
}

export const useAuthStore = create<AuthState>((set) => ({
  tenant: readStorage('afyasasa.tenant') ?? DEFAULT_TENANT,
  accessToken: readStorage('afyasasa.accessToken'),
  refreshToken: readStorage('afyasasa.refreshToken'),
  user: readStorage('afyasasa.user')
    ? (JSON.parse(readStorage('afyasasa.user') as string) as UserProfile)
    : null,
  hydrated: false,
  setTenant: (tenant) => {
    localStorage.setItem('afyasasa.tenant', tenant)
    set({ tenant })
  },
  setHydrated: (hydrated) => set({ hydrated }),
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
      hydrated: true,
    }))
  },
  setUser: (user) => {
    localStorage.setItem('afyasasa.user', JSON.stringify(user))
    set({ user })
  },
  syncFromStorage: () => {
    const accessToken = readStorage('afyasasa.accessToken')
    const refreshToken = readStorage('afyasasa.refreshToken')
    const userRaw = readStorage('afyasasa.user')
    set({
      tenant: readStorage('afyasasa.tenant') ?? DEFAULT_TENANT,
      accessToken,
      refreshToken,
      user: userRaw ? (JSON.parse(userRaw) as UserProfile) : null,
      hydrated: true,
    })
  },
  clearSession: () => {
    localStorage.removeItem('afyasasa.accessToken')
    localStorage.removeItem('afyasasa.refreshToken')
    localStorage.removeItem('afyasasa.user')
    sessionStorage.removeItem('afyasasa.activeScreen')
    set({ accessToken: null, refreshToken: null, user: null, hydrated: true })
  },
}))
