const PENDING = [
  'Live mailbox delivery (SMTP password on the host, EMAIL_DELIVERY_ENABLED, operator toggle, recipient allowlist).',
  'Sign-in one-time code stays off until enrollment, recovery, and helpdesk procedure exist.',
  'Official MOH 204A/333 templates and KHIS electronic submission.',
  'SHA claims submission (eligibility may exist; claims remain on the SHA portal).',
  'FHIR Kenya Core mapping is local only — no live DHA connection.',
  'Production database migrations, backup restore drill, and go-live cutover.',
  'Laboratory report layouts match Jalaram cards; catalogue intervals still need clinical sign-off.',
]

export function HospitalStatusPage({
  title = 'We are restoring this area',
  screen,
}: {
  title?: string
  screen?: string
}) {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
        Jalaram St. Christopher Hospital
      </p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{title}</h1>
      {screen ? (
        <p className="mt-1 text-sm font-medium text-slate-500">{screen}</p>
      ) : null}
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        We are working hard to restore this page and complete remaining hospital workflows. Clinical
        records were not deleted by this message.
      </p>
      <p className="mt-4 text-sm font-semibold text-slate-800">Still pending</p>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">
        {PENDING.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <a href="/" className="mt-6 inline-block text-sm font-semibold text-teal-700 hover:underline">
        Return to AfyaSasa
      </a>
    </div>
  )
}
