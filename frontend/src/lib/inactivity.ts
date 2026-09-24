import { endSession } from './auth-session'
import { getCachedSessionPolicy, loadSessionPolicy } from './session-policy'

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'pointerdown',
  'keydown',
  'touchstart',
  'click',
  'scroll',
]

type InactivityListener = (state: { remainingMs: number; warning: boolean }) => void

let timer: ReturnType<typeof setInterval> | null = null
let lastActivity = Date.now()
let lastHeartbeat = 0
let warningShown = false
let listener: InactivityListener | null = null
let started = false

function timeoutMs() {
  return getCachedSessionPolicy().inactivityTimeoutSeconds * 1000
}

function warningMs() {
  return getCachedSessionPolicy().inactivityWarningSeconds * 1000
}

async function heartbeat() {
  const now = Date.now()
  if (now - lastHeartbeat < 30_000) return
  lastHeartbeat = now
  try {
    const { apiRequest } = await import('./api')
    await apiRequest('/auth/activity', { method: 'POST' }, false)
  } catch {
    // Guard rejection is handled by the local timer / next API call.
  }
}

function onActivity() {
  lastActivity = Date.now()
  warningShown = false
  listener?.({ remainingMs: timeoutMs(), warning: false })
  void heartbeat()
}

function tick() {
  const idle = Date.now() - lastActivity
  const remaining = timeoutMs() - idle
  if (remaining <= 0) {
    void endSession('inactivity')
    return
  }
  if (remaining <= warningMs() && !warningShown) {
    warningShown = true
    listener?.({ remainingMs: remaining, warning: true })
    return
  }
  if (warningShown) {
    listener?.({ remainingMs: remaining, warning: true })
  }
}

export function startInactivityWatch(onChange?: InactivityListener) {
  listener = onChange ?? null
  if (started) return
  started = true
  lastActivity = Date.now()
  warningShown = false
  void loadSessionPolicy().then(() => {
    lastActivity = Date.now()
  })
  for (const event of ACTIVITY_EVENTS) {
    window.addEventListener(event, onActivity, { passive: true })
  }
  window.addEventListener('popstate', onActivity)
  timer = setInterval(tick, 1000)
  void heartbeat()
}

export function stopInactivityWatch() {
  if (!started) return
  started = false
  listener = null
  if (timer) clearInterval(timer)
  timer = null
  for (const event of ACTIVITY_EVENTS) {
    window.removeEventListener(event, onActivity)
  }
  window.removeEventListener('popstate', onActivity)
}

export function markUserActivity() {
  onActivity()
}
