export type NavRange = { from: string; to: string }

const NAV_RANGE_KEY = 'afyasasa.navRange'

function browserStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    const store = (globalThis as { sessionStorage?: Storage }).sessionStorage
    return store ?? null
  } catch {
    return null
  }
}

export function writeNavRange(range: NavRange) {
  browserStorage()?.setItem(NAV_RANGE_KEY, JSON.stringify(range))
}

export function readNavRange(): NavRange | null {
  try {
    const raw = browserStorage()?.getItem(NAV_RANGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<NavRange>
    if (typeof parsed.from === 'string' && typeof parsed.to === 'string') {
      return { from: parsed.from, to: parsed.to }
    }
  } catch {
    return null
  }
  return null
}

export function dispatchHospitalNavigate(screen: string, range?: NavRange) {
  if (range) writeNavRange(range)
  const win = globalThis as { dispatchEvent?: (event: Event) => boolean; CustomEvent?: typeof CustomEvent }
  if (typeof win.dispatchEvent !== 'function' || typeof win.CustomEvent !== 'function') return
  win.dispatchEvent(new win.CustomEvent('afyasasa:navigate', { detail: screen }))
}
