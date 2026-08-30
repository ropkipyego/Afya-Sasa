import { DEFAULT_TENANT } from './tenant-config'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export type PublicHospital = {
  code: string
  name: string
  address: string | null
  primaryColor: string | null
  logoUrl: string | null
  tagline: string | null
}

export async function fetchPublicHospitals(tenantHint = DEFAULT_TENANT): Promise<PublicHospital[]> {
  const response = await fetch(`${API_BASE}/auth/hospitals`, {
    headers: { 'X-Tenant': tenantHint },
  })
  if (!response.ok) {
    throw new Error('Could not load hospitals')
  }
  return response.json() as Promise<PublicHospital[]>
}
