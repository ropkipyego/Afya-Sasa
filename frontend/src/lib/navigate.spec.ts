import { describe, expect, it, beforeEach } from 'vitest'
import { dispatchHospitalNavigate, readNavRange, writeNavRange } from './navigate'

class MemoryStorage {
  private data = new Map<string, string>()
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
  clear() {
    this.data.clear()
  }
}

describe('director navigation date range', () => {
  const memory = new MemoryStorage()
  const dispatched: string[] = []

  beforeEach(() => {
    memory.clear()
    dispatched.length = 0
    Object.defineProperty(globalThis, 'sessionStorage', { value: memory, configurable: true })
    const listeners = new Map<string, Set<(event: Event) => void>>()
    Object.defineProperty(globalThis, 'dispatchEvent', {
      configurable: true,
      value: (event: Event) => {
        listeners.get(event.type)?.forEach((fn) => fn(event))
        return true
      },
    })
    if (typeof CustomEvent !== 'function') {
      Object.defineProperty(globalThis, 'CustomEvent', {
        configurable: true,
        value: class CustomEventPolyfill extends Event {
          detail: unknown
          constructor(type: string, init?: { detail?: unknown }) {
            super(type)
            this.detail = init?.detail
          }
        },
      })
    }
    listeners.set('afyasasa:navigate', new Set([
      (event: Event) => {
        dispatched.push((event as CustomEvent<string>).detail)
      },
    ]))
  })

  it('stores and restores the analytics period for the next hospital screen', () => {
    writeNavRange({ from: '2026-10-01', to: '2026-10-26' })
    expect(readNavRange()).toEqual({ from: '2026-10-01', to: '2026-10-26' })
  })

  it('keeps the period when a KPI drill-down opens another hospital screen', () => {
    dispatchHospitalNavigate('Cashier / Billing', { from: '2026-09-01', to: '2026-09-30' })
    expect(dispatched).toEqual(['Cashier / Billing'])
    expect(readNavRange()).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })
})
