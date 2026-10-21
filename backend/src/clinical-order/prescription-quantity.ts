export type QuantitySuggestion = {
  calculable: boolean
  quantity: number | null
  reason: string
}

const COUNTABLE_ROUTES = new Set(['oral', 'capsule', 'tablet'])
const COUNTABLE_UNITS = /(tablet|tab|capsule|cap|each|pcs|piece|unit)s?$/i

const TIMES_PER_DAY: Record<string, number> = {
  od: 1,
  'once daily': 1,
  'once a day': 1,
  daily: 1,
  bd: 2,
  bid: 2,
  'twice daily': 2,
  'twice a day': 2,
  tds: 3,
  tid: 3,
  'three times daily': 3,
  'three times a day': 3,
  qds: 4,
  qid: 4,
  'four times daily': 4,
  q24h: 1,
  q12h: 2,
  q8h: 3,
  q6h: 4,
}

export function administrationsPerDay(frequency: string): number | null {
  const key = frequency.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!key) return null
  if (TIMES_PER_DAY[key] != null) return TIMES_PER_DAY[key]
  const match = key.match(/^q\s*(\d+)\s*h(?:ours?)?$/)
  if (!match) return null
  const hours = Number(match[1])
  if (![4, 6, 8, 12, 24].includes(hours)) return null
  return 24 / hours
}

export function durationInDays(duration: string): number | null {
  const text = duration.trim().toLowerCase()
  if (!text) return null
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(d|day|days)?$/)
  if (!match) return null
  const days = Number(match[1])
  if (!Number.isFinite(days) || days <= 0 || days > 90) return null
  return days
}

export function suggestDispenseQuantity(input: {
  route: string
  unit?: string | null
  frequency: string
  duration: string
  unitsPerAdmin: string
}): QuantitySuggestion {
  const route = input.route.trim().toLowerCase()
  if (!COUNTABLE_ROUTES.has(route)) {
    return {
      calculable: false,
      quantity: null,
      reason: 'Enter quantity manually for liquids, injections, creams, inhalers and other non-countable forms.',
    }
  }
  if (input.unit && !COUNTABLE_UNITS.test(input.unit.trim())) {
    return {
      calculable: false,
      quantity: null,
      reason: 'Catalogue pack unit is not a countable tablet or capsule. Enter quantity manually.',
    }
  }
  const perAdmin = Number(input.unitsPerAdmin)
  if (!Number.isFinite(perAdmin) || perAdmin <= 0 || perAdmin > 20) {
    return {
      calculable: false,
      quantity: null,
      reason: 'Enter units taken each time before a quantity can be suggested.',
    }
  }
  const times = administrationsPerDay(input.frequency)
  const days = durationInDays(input.duration)
  if (times == null || days == null) {
    return {
      calculable: false,
      quantity: null,
      reason: 'Suggestion needs a standard frequency (OD/BD/TDS/QDS) and duration in days.',
    }
  }
  const quantity = Math.round(perAdmin * times * days * 1000) / 1000
  if (quantity <= 0 || quantity > 5000) {
    return {
      calculable: false,
      quantity: null,
      reason: 'Calculated quantity is outside a safe bound. Enter it manually.',
    }
  }
  return {
    calculable: true,
    quantity,
    reason: `${perAdmin} × ${times}/day × ${days} days`,
  }
}

export function lineValidationError(line: {
  itemId: string
  quantity: string | number
  dose: string
  frequency: string
  route?: string
}): string | null {
  if (!line.itemId) return 'Choose an approved catalogue product.'
  const qty = Number(line.quantity)
  if (!Number.isFinite(qty) || qty <= 0) return 'Enter a positive quantity.'
  if (qty > 5000) return 'Quantity is above the allowed bound.'
  if (!String(line.dose ?? '').trim() || !String(line.frequency ?? '').trim()) {
    return 'Dose and frequency are required.'
  }
  if (!String(line.route ?? '').trim()) return 'Route or dosage form is required.'
  return null
}
