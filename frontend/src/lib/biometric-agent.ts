const AGENT = (import.meta.env.VITE_BIOMETRIC_AGENT as string | undefined)?.replace(/\/$/, '') ??
  'http://127.0.0.1:7845'

export type BiometricReaderState =
  | 'SDK_UNAVAILABLE'
  | 'DEVICE_DISCONNECTED'
  | 'DEVICE_READY'
  | 'ERROR'
  | 'AGENT_UNREACHABLE'

export type BiometricCapture = {
  deviceKey: string
  operation: string
  result: string
  externalSubjectId?: string
  externalReference?: string
  confidence?: number
  qualityLabel?: string
  qualityScore?: number
  fingerPosition?: string
  candidates?: { externalSubjectId: string; confidence?: number }[]
  capturedAt: string
  nonce: string
  deviceHmac?: string
  lastError?: string
  readerState?: string
}

export type BiometricDeviceStatus = {
  reachable: boolean
  sdk: BiometricReaderState
  readerPresent: boolean
  deviceKey: string | null
  lastError: string | null
}

export async function biometricDeviceStatus(): Promise<BiometricDeviceStatus> {
  try {
    const response = await fetch(`${AGENT}/device`, { signal: AbortSignal.timeout(4000) })
    const body = (await response.json().catch(() => ({}))) as {
      sdk?: string
      readerPresent?: boolean
      deviceKey?: string | null
      lastError?: string | null
    }
    if (!response.ok) {
      return {
        reachable: true,
        sdk: 'ERROR',
        readerPresent: false,
        deviceKey: body.deviceKey ?? null,
        lastError: body.lastError || 'Biometric agent returned an error.',
      }
    }
    const sdk = (body.sdk || 'ERROR') as BiometricReaderState
    return {
      reachable: true,
      sdk,
      readerPresent: Boolean(body.readerPresent) && sdk === 'DEVICE_READY',
      deviceKey: body.deviceKey ?? null,
      lastError: body.lastError ?? null,
    }
  } catch {
    return {
      reachable: false,
      sdk: 'AGENT_UNREACHABLE',
      readerPresent: false,
      deviceKey: null,
      lastError: 'Cannot contact the local biometric agent. Check that it is running on this workstation.',
    }
  }
}

export async function captureFingerprint(
  operation: 'enroll' | 'verify' | 'identify',
  finger?: string,
) {
  const query = new URLSearchParams({ operation })
  if (finger) query.set('finger', finger)
  const response = await fetch(`${AGENT}/capture?${query}`, {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
  })
  const body = (await response.json().catch(() => ({}))) as BiometricCapture & { error?: string }
  if (!response.ok) {
    const error = new Error(
      body.lastError ||
        body.error ||
        'Fingerprint reader unavailable. Continue with patient number or national ID.',
    )
    Object.assign(error, { capture: body, readerState: body.readerState })
    throw error
  }
  return body
}

export function readerStateLabel(state: BiometricReaderState | string | null | undefined) {
  switch (state) {
    case 'DEVICE_READY':
      return 'Connected'
    case 'DEVICE_DISCONNECTED':
      return 'Disconnected'
    case 'SDK_UNAVAILABLE':
      return 'SDK unavailable'
    case 'AGENT_UNREACHABLE':
      return 'Agent unreachable'
    case 'ERROR':
      return 'Error'
    default:
      return 'Unknown'
  }
}

export async function biometricAgentHealth() {
  const status = await biometricDeviceStatus()
  return status.reachable
}
