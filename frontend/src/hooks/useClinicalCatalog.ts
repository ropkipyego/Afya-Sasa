import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../lib/api'
import { normalizeClinicalCatalog, type ClinicalCatalog } from '../lib/clinical-catalog'

export function useClinicalCatalog() {
  return useQuery({
    queryKey: ['clinical-catalog'],
    queryFn: async () => {
      try {
        const catalog = await apiRequest<Partial<ClinicalCatalog>>('/admin/clinical-catalog')
        return normalizeClinicalCatalog(catalog)
      } catch {
        return normalizeClinicalCatalog(null)
      }
    },
    staleTime: 60_000,
  })
}
