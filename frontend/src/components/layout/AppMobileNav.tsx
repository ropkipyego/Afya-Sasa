import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown, Hospital, Menu, X } from 'lucide-react'
import clsx from 'clsx'
import { groupIcons, type NavItem } from '../../lib/navigation'
import { SINGLE_TENANT_MODE } from '../../lib/tenant-config'

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
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

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

  const drawer =
    open ? (
      <div className="fixed inset-0 z-[100] xl:hidden">
        <button
          type="button"
          aria-label="Close menu overlay"
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
        <aside className="absolute inset-y-0 left-0 flex w-[min(88vw,20rem)] max-w-full flex-col bg-white shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5">
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

          <nav className="flex-1 space-y-2 overflow-y-auto overscroll-contain p-4">
            {Object.entries(grouped).map(([group, groupItems]) => {
              const GroupIcon = groupIcons[group] ?? Hospital
              const isOpen = !collapsedGroups[group]
              return (
                <div key={group}>
                  <button
                    type="button"
                    className="mb-1 flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50"
                    onClick={() =>
                      setCollapsedGroups((current) => ({
                        ...current,
                        [group]: !current[group],
                      }))
                    }
                    aria-expanded={isOpen}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <GroupIcon className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {group}
                      </span>
                    </span>
                    <ChevronDown
                      className={clsx(
                        'h-4 w-4 shrink-0 text-teal-600 transition-transform duration-200',
                        isOpen ? 'rotate-180' : 'rotate-0',
                      )}
                      aria-hidden
                    />
                  </button>
                  {isOpen ? (
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
                  ) : null}
                </div>
              )
            })}
          </nav>
        </aside>
      </div>
    ) : null

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2 xl:hidden">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="touch-target inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm sm:h-12 sm:w-12"
        >
          <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ActiveIcon className="h-4 w-4 shrink-0 text-teal-600" />
            <p className="truncate text-sm font-bold text-slate-900">{activeScreen}</p>
          </div>
          {!SINGLE_TENANT_MODE ? (
            <p className="truncate text-xs text-slate-500">{tenant}</p>
          ) : null}
        </div>
      </div>

      {typeof document !== 'undefined' ? createPortal(drawer, document.body) : drawer}
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
