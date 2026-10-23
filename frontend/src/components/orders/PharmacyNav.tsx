import clsx from 'clsx'

export type PharmacyScreen =
  | 'overview'
  | 'dispense-opd'
  | 'dispense-ipd'
  | 'dispense-pending'
  | 'dispense-partial'
  | 'dispense-history'
  | 'sales'
  | 'sales-unpaid'
  | 'sales-payments'
  | 'stock'
  | 'receive'
  | 'transfers'
  | 'adjustments'
  | 'returns'
  | 'expiry'
  | 'lowstock'
  | 'stocktake'
  | 'products'
  | 'categories'
  | 'prices'
  | 'import'
  | 'otc'
  | 'pos'
  | 'reports'

const GROUPS: Array<{ label: string; items: Array<{ id: PharmacyScreen; label: string }> }> = [
  { label: 'Today', items: [{ id: 'overview', label: 'Dispensing dashboard' }] },
  {
    label: 'Queue',
    items: [
      { id: 'dispense-pending', label: 'Pending prescriptions' },
      { id: 'dispense-opd', label: 'OPD' },
      { id: 'dispense-ipd', label: 'IPD' },
      { id: 'dispense-history', label: 'History' },
    ],
  },
  {
    label: 'Counter',
    items: [
      { id: 'otc', label: 'OTC sales' },
      { id: 'sales', label: 'Collections' },
      { id: 'sales-unpaid', label: 'Outstanding' },
    ],
  },
  {
    label: 'On hand',
    items: [
      { id: 'stock', label: 'Stock' },
      { id: 'expiry', label: 'Expiry' },
      { id: 'lowstock', label: 'Low stock' },
    ],
  },
]

export function PharmacyNav({
  active,
  onChange,
}: {
  active: PharmacyScreen
  onChange: (id: PharmacyScreen) => void
}) {
  return (
    <nav className="w-full shrink-0 space-y-5 lg:w-56">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">{group.label}</p>
          <div className="flex flex-wrap gap-1 lg:flex-col">
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-left text-sm',
                  active === item.id
                    ? 'bg-teal-700 font-semibold text-white'
                    : 'text-slate-700 hover:bg-slate-100',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}
