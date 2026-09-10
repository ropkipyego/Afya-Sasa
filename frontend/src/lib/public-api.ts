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

export async function fetchPublicPatientScan<T>(code: string, tenantHint = DEFAULT_TENANT): Promise<T> {
  const response = await fetch(`${API_BASE}/patients/scan/${encodeURIComponent(code)}`, {
    headers: { 'X-Tenant': tenantHint },
  })
  if (!response.ok) {
    throw new Error('This QR code is not a recognised patient card.')
  }
  return response.json() as Promise<T>
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
