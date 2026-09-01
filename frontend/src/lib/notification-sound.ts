import { getUserPreferences } from './user-preferences'

let audioCtx: AudioContext | null = null

function getCtx() {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    audioCtx = new Ctx()
  }
  return audioCtx
}

function tone(ctx: AudioContext, frequency: number, start: number, duration: number, volume = 0.15) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

export function playNotificationSound(severity: 'info' | 'success' | 'warning' | 'critical' = 'info') {
  if (!getUserPreferences().notificationSounds) return
  const ctx = getCtx()
  if (!ctx) return
  void ctx.resume()

  const now = ctx.currentTime
  if (severity === 'critical') {
    for (let i = 0; i < 4; i += 1) {
      tone(ctx, i % 2 === 0 ? 880 : 660, now + i * 0.22, 0.18, 0.2)
    }
    return
  }
  if (severity === 'warning') {
    tone(ctx, 740, now, 0.12)
    tone(ctx, 620, now + 0.14, 0.12)
    return
  }
  tone(ctx, severity === 'success' ? 660 : 520, now, 0.1, 0.12)
}

/** @deprecated Use playNotificationSound('critical') */
export function playEmergencyAlertSound() {
  playNotificationSound('critical')
}
