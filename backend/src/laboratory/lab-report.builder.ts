import type { LabRequest, LabRequestItem, LabResult, LabSample } from './laboratory.entities';
import { LAB_REPORT_LAYOUTS } from './lab-report-layouts';

type ReportDetail = LabRequest & {
  cancelledReason?: string | null;
  createdAt?: Date | string;
  verifiedAt?: Date | string | null;
  items?: Array<
    LabRequestItem & {
      results?: LabResult[];
      test?: { name?: string } | null;
      panel?: { name?: string } | null;
      orderableTest?: {
        name?: string;
        code?: string;
        isPanel?: boolean;
        parameters?: Array<{ code?: string; name?: string; active?: boolean; calculatedFormula?: string | null }>;
      } | null;
    }
  >;
  samples?: LabSample[];
  patient?: {
    patientNo?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: string;
    primaryPhone?: string | null;
  };
  encounter?: { clinicianName?: string | null; notes?: string | null } | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function flagLabel(flag?: string | null) {
  const normalized = (flag ?? '').toLowerCase();
  if (normalized === 'unassessed') return 'No reference interval';
  if (normalized === 'normal') return '';
  if (normalized === 'low') return 'L';
  if (normalized === 'high') return 'H';
  if (normalized === 'critically_low') return 'Critical low';
  if (normalized === 'critically_high' || normalized === 'critical') return 'Critical high';
  if (!normalized) return 'No flag';
  return 'Unrecognised flag';
}

function flagClass(flag?: string | null) {
  const normalized = (flag ?? '').toLowerCase();
  if (normalized === 'unassessed') return 'flag-unassessed';
  if (normalized === 'normal') return 'flag-normal';
  if (normalized.includes('critical')) return 'flag-critical';
  if (normalized === 'low' || normalized === 'high') return 'flag-abnormal';
  return 'flag-unknown';
}

function ageSex(dob?: string, gender?: string) {
  if (!dob) return gender ? escapeHtml(gender) : '—';
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return escapeHtml(gender ?? '—');
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years -= 1;
  const sex = (gender ?? '').slice(0, 1).toUpperCase();
  return sex ? `${years}/${sex}` : String(years);
}

function formatDay(value?: Date | string | null) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', { timeZone: 'Africa/Nairobi' });
}

function matchLayout(name: string, code?: string) {
  const hay = `${code ?? ''} ${name}`.toUpperCase();
  const matched = Object.entries(LAB_REPORT_LAYOUTS).filter(([key]) => hay.includes(key));
  if (!matched.length) return null;
  if (matched.length === 1) return matched[0][1];
  return {
    title: [...new Set(matched.map(([, layout]) => layout.title))].join(' · '),
    parameters: matched.flatMap(([, layout]) => layout.parameters),
    remarks: matched.flatMap(([, layout]) => layout.remarks ?? []),
  };
}

export function buildStructuredLabReportHtml(
  detail: ReportDetail,
  options?: { facilityName?: string; verifierName?: string | null; clinicianName?: string | null },
): string {
  const patient = detail.patient;
  const facility = escapeHtml(options?.facilityName || 'Jalaram St. Christopher Hospital');
  const incomplete: string[] = [];
  const sections: string[] = [];

  for (const item of detail.items ?? []) {
    const testName = item.orderableTest?.name ?? item.test?.name ?? item.panel?.name ?? 'Test';
    const layout = matchLayout(testName, item.orderableTest?.code);
    const required = (item.orderableTest?.parameters ?? []).filter(
      (parameter) =>
        (parameter as { active?: boolean; calculatedFormula?: string }).active !== false &&
        !(parameter as { calculatedFormula?: string }).calculatedFormula,
    );
    const current = (item.results ?? []).filter((row) => {
      const replaced = (item.results ?? []).some((other) => other.supersedesId === row.id);
      return !replaced;
    });
    if (required.length) {
      const have = new Set(
        current
          .map((row) => (row.parameter as { code?: string } | undefined)?.code)
          .filter(Boolean),
      );
      const missing = required.filter((parameter) => !have.has((parameter as { code?: string }).code));
      if (missing.length) {
        incomplete.push(
          `${testName}: missing ${missing.map((parameter) => (parameter as { code?: string }).code).join(', ')}`,
        );
      }
    }

    const rows = current
      .map((result) => {
        const code = result.parameter ? String((result.parameter as { code?: string; name?: string }).code ?? '') : '';
        const label =
          (result.parameter as { name?: string } | undefined)?.name ||
          layout?.parameters.find((row) => row.code === code)?.label ||
          code ||
          testName;
        const pending = result.amendmentReason && !result.verifiedAt ? ' · Amendment pending verification' : '';
        return `<tr class="${flagClass(result.flag)}">
        <td>${escapeHtml(label)}</td>
        <td class="value">${escapeHtml(result.value)}</td>
        <td>${escapeHtml(result.unit || '')}</td>
        <td>${escapeHtml(flagLabel(result.flag))}${pending ? escapeHtml(pending) : ''}</td>
        <td>${escapeHtml(result.referenceRange || 'Not established')}</td>
      </tr>`;
      })
      .join('');

    const remarks = (layout?.remarks ?? [])
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join('');
    const comments = current
      .map((result) => result.resultComment)
      .filter(Boolean)
      .map((comment) => `<li>${escapeHtml(String(comment))}</li>`)
      .join('');

    sections.push(`<h2>${escapeHtml(layout?.title ?? testName)}</h2>
<table>
<thead><tr><th>Test</th><th>Result</th><th>Units</th><th>Flag</th><th>Ref Interval</th></tr></thead>
<tbody>${rows || '<tr><td colspan="5">No structured results</td></tr>'}</tbody>
</table>
${comments ? `<p class="meta">Comments</p><ul>${comments}</ul>` : ''}
${remarks ? `<p class="meta">Interpretive remarks (catalogue / approved card — not copied from another patient)</p><ul class="remarks">${remarks}</ul>` : ''}`);
  }

  const samples = (detail.samples ?? [])
    .map(
      (sample) =>
        `<li>${escapeHtml(sample.barcode)} · ${escapeHtml(sample.type)}${
          sample.condition ? ` · ${escapeHtml(sample.condition)}` : ''
        }${sample.rejectionReason ? ` · rejected: ${escapeHtml(sample.rejectionReason)}` : ''}</li>`,
    )
    .join('');

  const clinician = options?.clinicianName || '—';
  const phone = patient?.primaryPhone ? String(patient.primaryPhone).replace(/.(?=.{3})/g, (ch) => (/\d/.test(ch) ? '·' : ch)) : '—';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(detail.requestNo)} laboratory report</title>
<style>
body{font-family:"Segoe UI",system-ui,sans-serif;color:#0f172a;padding:28px;max-width:920px;margin:0 auto}
.brand{text-align:center;color:#0f766e;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:12px}
h1{font-size:1.35rem;margin:4px 0 12px;text-align:center}
h2{font-size:.95rem;margin:22px 0 8px;color:#0f766e}
.idgrid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;font-size:13px;margin:16px 0}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#ecfdf5}
.meta{color:#475569;font-size:13px;margin:8px 0}
.banner{padding:8px 12px;border-radius:8px;margin:16px 0;font-size:13px}
.unassessed{background:#f1f5f9}
.amended{background:#fff7ed}
.incomplete{background:#fef2f2}
.flag-unassessed td:nth-child(4){background:#e2e8f0;font-weight:600}
.flag-normal td:nth-child(4){background:#ecfdf5}
.flag-abnormal td:nth-child(4){background:#fff7ed;font-weight:700}
.flag-critical td:nth-child(4){background:#ffe4e6;font-weight:700}
.flag-unknown td:nth-child(4){background:#e2e8f0}
.comment,.value{white-space:pre-wrap;word-break:break-word}
.footer{margin-top:28px;border-top:1px solid #cbd5e1;padding-top:12px;font-size:12px;color:#334155;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.remarks{font-size:12px;color:#334155}
</style></head><body>
<p class="brand">Caring Hearts Healing Hands</p>
<h1>${facility}</h1>
<div class="idgrid">
  <div>PATIENT NAME : ${escapeHtml(`${patient?.firstName ?? ''} ${patient?.lastName ?? ''}`.trim() || '—')}</div>
  <div>PATIENT NO. : ${escapeHtml(patient?.patientNo ?? '—')}</div>
  <div>AGE/SEX : ${ageSex(patient?.dateOfBirth, patient?.gender)}</div>
  <div>REFERRING CLINICIAN : ${escapeHtml(clinician)}</div>
  <div>TEL : ${escapeHtml(phone)}</div>
  <div>DATE REPORTED : ${escapeHtml(formatDay(new Date()))}</div>
  <div>DATE REGISTERED : ${escapeHtml(formatDay(detail.createdAt ?? null))}</div>
  <div>REQUEST : ${escapeHtml(detail.requestNo)} · ${escapeHtml(detail.status)}</div>
</div>
${detail.status === 'cancelled' ? `<div class="banner amended">Cancelled${detail.cancelledReason ? `: ${escapeHtml(detail.cancelledReason)}` : ''}</div>` : ''}
${incomplete.length ? `<div class="banner incomplete">Incomplete panel — not a complete report. ${escapeHtml(incomplete.join('; '))}</div>` : ''}
<p class="meta unassessed">Unassessed means no applicable approved reference interval was used. It is not a normal result. Flags below are stored values, not a live catalogue recalculation.</p>
${samples ? `<p class="meta">Specimens</p><ul>${samples}</ul>` : ''}
${sections.join('') || '<p>No structured results</p>'}
<p class="meta">FLAG KEY: L = Low; H = High; * = Abnormal; ! = Critical result</p>
<p class="meta">Laboratory Technologist<br/>${escapeHtml(options?.verifierName || '—')}</p>
<div class="footer">
  <div>0726 415 127 · 0726 100 462<br/>Hyrax, Nakuru–Nairobi highway, Nakuru, Kenya</div>
  <div>info@jalaram.co.ke<br/>radio@jalaram.co.ke</div>
</div>
</body></html>`;
}
