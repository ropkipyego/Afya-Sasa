import clsx from 'clsx'

export function WorkspaceTabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { id: T; label: string; icon?: React.ReactNode }[]
  active: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <div className={clsx('workspace-tabs', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={clsx(
            'workspace-tab',
            active === tab.id && 'workspace-tab-active',
          )}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  )
}
