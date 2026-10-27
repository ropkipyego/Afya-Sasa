import { useAuthStore } from './auth-store'

export function canAny(permissions: string[] | undefined, keys: string[]) {
  const held = permissions ?? []
  return keys.some((key) => held.includes(key))
}

export function useCan(...keys: string[]) {
  return useAuthStore((state) => canAny(state.user?.permissions, keys))
}
