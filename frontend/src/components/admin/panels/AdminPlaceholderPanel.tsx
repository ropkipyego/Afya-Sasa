import { Card } from '../../ui'

export function AdminPlaceholderPanel({
  title,
  description,
  items,
}: {
  title: string
  description: string
  items?: string[]
}) {
  return (
    <Card className="p-8">
      <h3 className="text-xl font-bold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
      {items?.length ? (
        <ul className="mt-6 space-y-2">
          {items.map((item) => (
            <li key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  )
}
