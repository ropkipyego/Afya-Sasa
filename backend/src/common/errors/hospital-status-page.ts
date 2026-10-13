export const HOSPITAL_PENDING_WORK = [
  'Live mailbox delivery (SMTP password on the host, EMAIL_DELIVERY_ENABLED, operator toggle, recipient allowlist).',
  'Sign-in one-time code (AUTH_MFA_OTP_ENABLED stays off until enrollment, recovery, and helpdesk procedure exist).',
  'Official MOH 204A/333 templates and KHIS electronic submission.',
  'SHA claims submission (eligibility may exist; claims remain on the SHA portal).',
  'FHIR Kenya Core mapping is local only — no live DHA connection.',
  'Production database migrations, backup restore drill, and go-live cutover (not performed from this workstation).',
  'Laboratory report layouts match Jalaram cards; catalogue intervals and clinical sign-off remain hospital responsibility.',
];

export function buildHospitalStatusHtml(status = 404) {
  const title = status === 404 ? 'Page not found' : 'We are restoring this service';
  const items = HOSPITAL_PENDING_WORK.map((item) => `<li>${item}</li>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${status} · Jalaram Hospital</title>
  <style>
    body{margin:0;font-family:"Segoe UI",system-ui,sans-serif;background:#f8fafc;color:#0f172a}
    .wrap{max-width:720px;margin:8vh auto;padding:32px}
    .card{background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:32px;box-shadow:0 20px 50px rgba(15,23,42,.06)}
    .brand{color:#0f766e;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase}
    h1{margin:8px 0 12px;font-size:1.75rem}
    p{color:#475569;line-height:1.55}
    ul{margin:16px 0 0;padding-left:1.2rem;color:#334155}
    li{margin:8px 0}
    a{color:#0f766e;font-weight:600}
  </style>
</head>
<body>
  <div class="wrap"><div class="card">
    <p class="brand">Jalaram St. Christopher Hospital · AfyaSasa</p>
    <h1>${title}</h1>
    <p>We are working to restore this page and complete remaining hospital workflows. If you followed a bookmark, return to the sign-in screen. Clinical records were not deleted by this message.</p>
    <p><strong>Still pending before we treat the live hospital as complete:</strong></p>
    <ul>${items}</ul>
    <p><a href="/">Return to AfyaSasa</a></p>
  </div></div>
</body>
</html>`;
}
