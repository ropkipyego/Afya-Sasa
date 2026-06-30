import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Hospital, Menu, X } from 'lucide-react'
import clsx from 'clsx'
import { groupIcons, type NavItem } from '../../lib/navigation'

export function AppMobileNav({
  items,
  activeScreen,
  onNavigate,
  tenant,
}: {
  items: NavItem[]
  activeScreen: string
  onNavigate: (label: string) => void
  tenant: string
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const grouped = items.reduce(
    (acc, item) => {
      acc[item.group] = [...(acc[item.group] ?? []), item]
      return acc
    },
    {} as Record<string, NavItem[]>,
  )

  const activeItem = items.find((i) => i.label === activeScreen)
  const ActiveIcon = activeItem?.icon ?? Hospital

  return (
    <>
      <div className="flex w-full items-center gap-3 lg:hidden">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="touch-target inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ActiveIcon className="h-4 w-4 shrink-0 text-teal-600" />
            <p className="truncate text-sm font-bold text-slate-900">{activeScreen}</p>
          </div>
          <p className="truncate text-xs text-slate-500">{tenant}</p>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu overlay"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(100vw-3rem,22rem)] flex-col bg-white shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 p-2 text-white">
                  <Hospital className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600">AfyaSasa</p>
                  <p className="text-sm font-bold">Clinical EMR</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="touch-target inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-5 overflow-y-auto p-4">
              {Object.entries(grouped).map(([group, groupItems]) => {
                const GroupIcon = groupIcons[group] ?? Hospital
                return (
                  <div key={group}>
                    <div className="mb-2 flex items-center gap-2 px-2">
                      <GroupIcon className="h-4 w-4 text-slate-400" />
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{group}</p>
                    </div>
                    <div className="space-y-1">
                      {groupItems.map((item) => (
                        <NavButton
                          key={item.label}
                          icon={item.icon}
                          label={item.label}
                          shortLabel={item.shortLabel}
                          active={activeScreen === item.label}
                          onClick={() => {
                            onNavigate(item.label)
                            setOpen(false)
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  )
}

function NavButton({
  icon: Icon,
  label,
  shortLabel,
  active,
  onClick,
}: {
  icon: LucideIcon
  label: string
  shortLabel?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'touch-target flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-sm font-semibold transition',
        active ? 'bg-teal-600 text-white shadow-md' : 'text-slate-700 hover:bg-slate-100',
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="truncate">{shortLabel ?? label}</span>
    </button>
  )
}
