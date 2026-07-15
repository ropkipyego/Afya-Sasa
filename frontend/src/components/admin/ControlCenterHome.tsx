import clsx from 'clsx'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Input } from '../ui'
import type { ControlCenterSection } from './HospitalControlCenter'
import {
  controlCenterCategories,
  filterControlCenterCards,
} from './control-center-sections'
import { canAccessControlCenterSection } from '../../lib/control-center-permissions'

export function ControlCenterHome({
  permissions,
  onOpen,
}: {
  permissions: string[]
  onOpen: (section: Exclude<ControlCenterSection, 'home'>) => void
}) {
  const [query, setQuery] = useState('')

  const cards = useMemo(
    () =>
      filterControlCenterCards(query).filter((card) =>
        canAccessControlCenterSection(permissions, card.id),
      ),
    [permissions, query],
  )

  return (
    <div className="space-y-8">
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-9"
          placeholder="Search configuration — wards, templates, users…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {controlCenterCategories.map((category) => {
        const categoryCards = cards.filter((card) => card.category === category)
        if (!categoryCards.length) return null
        return (
          <section key={category}>
            <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">
              {category}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {categoryCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onOpen(card.id)}
                  className={clsx(
                    'card-hover group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition',
                    'hover:border-teal-200 hover:shadow-md',
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-teal-50 p-3 text-teal-700 group-hover:bg-teal-600 group-hover:text-white">
                      {card.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900">{card.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{card.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )
      })}

      {!cards.length ? (
        <p className="py-16 text-center text-sm text-slate-500">No configuration areas match your search.</p>
      ) : null}
    </div>
  )
}
