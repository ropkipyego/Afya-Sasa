export type UserPreferences = {
  notificationSounds: boolean
}

const STORAGE_KEY = 'afyasasa.userPreferences'

const defaults: UserPreferences = {
  notificationSounds: true,
}

export function getUserPreferences(): UserPreferences {
  if (typeof window === 'undefined') return defaults
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    return { ...defaults, ...JSON.parse(raw) }
  } catch {
    return defaults
  }
}

export function setUserPreferences(partial: Partial<UserPreferences>): UserPreferences {
  const next = { ...getUserPreferences(), ...partial }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('afyasasa-preferences-changed', { detail: next }))
  return next
}
