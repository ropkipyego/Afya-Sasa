import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '../lib/api'
import {
  mergeClinicalCatalogPatch,
  syncCatalogDependencies,
  type ExtendedClinicalCatalog,
} from '../lib/hospital-configuration'
import { normalizeClinicalCatalog, type ClinicalCatalog } from '../lib/clinical-catalog'

type SettingsResponse = {
  smsSenderName: string
  patientIdPrefix: string
  triageSystem: string
  clinicalCatalog?: Partial<ClinicalCatalog>
  tenant?: {
    name: string
    code: string
    address?: string | null
    mohFacilityCode?: string | null
    licenceNumber?: string | null
  }
}

export function useHospitalConfiguration() {
  const queryClient = useQueryClient()

  const settingsQuery = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => apiRequest<SettingsResponse>('/admin/settings'),
  })

  const catalog = syncCatalogDependencies(
    normalizeClinicalCatalog(settingsQuery.data?.clinicalCatalog) as ExtendedClinicalCatalog,
  )

  const saveCatalog = useMutation({
    mutationFn: async (patch: Partial<ExtendedClinicalCatalog>) => {
      const merged = mergeClinicalCatalogPatch(settingsQuery.data?.clinicalCatalog, patch)
      return apiRequest('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          clinicalCatalog: merged,
        }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      await queryClient.invalidateQueries({ queryKey: ['clinical-catalog'] })
    },
  })

  const saveSettings = useMutation({
    mutationFn: async (body: {
      smsSenderName?: string
      patientIdPrefix?: string
      triageSystem?: string
      clinicalCatalog?: Partial<ExtendedClinicalCatalog>
    }) => {
      const clinicalCatalog = body.clinicalCatalog
        ? mergeClinicalCatalogPatch(settingsQuery.data?.clinicalCatalog, body.clinicalCatalog)
        : undefined
      return apiRequest('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          smsSenderName: body.smsSenderName,
          patientIdPrefix: body.patientIdPrefix,
          triageSystem: body.triageSystem,
          ...(clinicalCatalog ? { clinicalCatalog } : {}),
        }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      await queryClient.invalidateQueries({ queryKey: ['clinical-catalog'] })
    },
  })

  return {
    settings: settingsQuery.data,
    catalog,
    isLoading: settingsQuery.isLoading,
    saveCatalog,
    saveSettings,
    invalidate: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      void queryClient.invalidateQueries({ queryKey: ['clinical-catalog'] })
    },
  }
}
