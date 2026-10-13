const PREFIX = 'afyasasa.workspace.'

export function readWorkspaceState<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeWorkspaceState(key: string, value: unknown) {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* ignore quota */
  }
}

export function readScrollPosition(screen: string) {
  return Number(sessionStorage.getItem(`${PREFIX}scroll.${screen}`) ?? 0)
}

export function writeScrollPosition(screen: string, y: number) {
  sessionStorage.setItem(`${PREFIX}scroll.${screen}`, String(Math.max(0, Math.round(y))))
}

const unsaved = new Set<string>()

export function markFormDirty(formId: string) {
  unsaved.add(formId)
}

export function markFormClean(formId: string) {
  unsaved.delete(formId)
}

export function hasUnsavedChanges() {
  return unsaved.size > 0
}

export function confirmLeaveIfDirty() {
  if (!hasUnsavedChanges()) return true
  return window.confirm('You have unsaved changes. Leave this page?')
}
