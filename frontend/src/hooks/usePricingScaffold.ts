import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../lib/api'
import { useAuthStore } from '../lib/auth-store'

export type PricingScaffoldItem = {
  code: string
  name: string
  category: string
  active: boolean
}

export type PricingScaffold = {
  enabled: boolean
  items: PricingScaffoldItem[]
}

export function usePricingScaffold() {
  const user = useAuthStore((state) => state.user)
  const isDirector =
    user?.roles.includes('administrator') ||
    user?.roles.includes('superadmin') ||
    user?.permissions.includes('settings:manage')

  return useQuery({
    queryKey: ['pricing-scaffold'],
    queryFn: () => apiRequest<PricingScaffold>('/admin/pricing-scaffold'),
    enabled: Boolean(isDirector),
    staleTime: 5 * 60_000,
  })
}

/** Active service codes for future billing hooks — no amounts exposed. */
export function useActiveServiceCodes() {
  const query = usePricingScaffold()
  const codes =
    query.data?.enabled && query.data.items.length
      ? query.data.items.filter((item) => item.active)
      : []
  return { ...query, activeCodes: codes }
}
