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
  | 'reports'

const GROUPS: Array<{ label: string; items: Array<{ id: PharmacyScreen; label: string }> }> = [
  { label: 'Control Center', items: [{ id: 'overview', label: 'Today' }] },
  {
    label: 'Dispensing',
    items: [
      { id: 'dispense-opd', label: 'OPD' },
      { id: 'dispense-ipd', label: 'IPD' },
      { id: 'dispense-pending', label: 'Pending requests' },
      { id: 'dispense-partial', label: 'Partial dispensing' },
      { id: 'dispense-history', label: 'History' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { id: 'sales', label: 'Sales dashboard' },
      { id: 'sales-unpaid', label: 'Unpaid sales' },
      { id: 'sales-payments', label: 'Payments' },
      { id: 'otc', label: 'OTC' },
    ],
  },
  {
    label: 'Stock',
    items: [
      { id: 'stock', label: 'Stock overview' },
      { id: 'receive', label: 'Receive stock' },
      { id: 'transfers', label: 'Transfers' },
      { id: 'adjustments', label: 'Adjustments' },
      { id: 'returns', label: 'Returns' },
      { id: 'expiry', label: 'Batches & expiry' },
      { id: 'lowstock', label: 'Low stock' },
    ],
  },
  {
    label: 'Stock take',
    items: [
      { id: 'stocktake', label: 'New / import / review' },
    ],
  },
  {
    label: 'Products & prices',
    items: [
      { id: 'products', label: 'Products' },
      { id: 'categories', label: 'Categories' },
      { id: 'prices', label: 'Prices' },
      { id: 'import', label: 'Import' },
    ],
  },
  { label: 'Reports', items: [{ id: 'reports', label: 'Department export' }] },
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
