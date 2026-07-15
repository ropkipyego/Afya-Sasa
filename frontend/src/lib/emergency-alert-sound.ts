/**
 * Lightweight Web Audio alert for emergency critical events.
 * No external assets required.
 */
let audioCtx: AudioContext | null = null

function getCtx() {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    audioCtx = new Ctx()
  }
  return audioCtx
}

export function playEmergencyAlertSound() {
  const ctx = getCtx()
  if (!ctx) return
  void ctx.resume()

  const now = ctx.currentTime
  for (let i = 0; i < 3; i += 1) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = i % 2 === 0 ? 880 : 660
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.18, now + i * 0.28 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.28 + 0.22)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + i * 0.28)
    osc.stop(now + i * 0.28 + 0.24)
  }
}
