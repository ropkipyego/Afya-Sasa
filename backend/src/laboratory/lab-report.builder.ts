import type { LabRequest, LabRequestItem, LabResult, LabSample } from './laboratory.entities';

type ReportDetail = LabRequest & {
  items?: Array<
    LabRequestItem & {
      results?: LabResult[];
      test?: { name?: string } | null;
      panel?: { name?: string } | null;
      orderableTest?: {
        name?: string;
        code?: string;
        isPanel?: boolean;
        parameters?: Array<{ code?: string; active?: boolean; calculatedFormula?: string | null }>;
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
  };
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
  if (normalized === 'normal') return 'Normal';
  if (normalized === 'low') return 'Low';
  if (normalized === 'high') return 'High';
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

export function buildStructuredLabReportHtml(
  detail: ReportDetail,
  options?: { facilityName?: string; verifierName?: string | null },
): string {
  const patient = detail.patient;
  const facility = escapeHtml(options?.facilityName || 'Jalaram St. Christopher Hospital');
  const incomplete: string[] = [];
  const rows = (detail.items ?? []).flatMap((item) => {
    const testName = item.orderableTest?.name ?? item.test?.name ?? item.panel?.name ?? 'Test';
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
    return current.map(
      (result) => `<tr class="${flagClass(result.flag)}">
        <td>${escapeHtml(testName)}</td>
        <td>${escapeHtml(result.parameter ? String((result.parameter as { code?: string }).code ?? '') : '')}</td>
        <td class="value">${escapeHtml(result.value)}${result.unit ? ` ${escapeHtml(result.unit)}` : ''}</td>
        <td>${escapeHtml(result.referenceRange || 'Not established')}</td>
        <td>${escapeHtml(flagLabel(result.flag))}</td>
        <td>${result.verifiedAt ? 'Verified' : 'Draft'}${result.amendmentReason ? ' · Amendment pending verification' : ''}</td>
        <td class="comment">${escapeHtml(result.resultComment || '')}</td>
      </tr>`,
    );
  });

  const samples = (detail.samples ?? [])
    .map(
      (sample) =>
        `<li>${escapeHtml(sample.barcode)} · ${escapeHtml(sample.type)}${
          sample.condition ? ` · ${escapeHtml(sample.condition)}` : ''
        }${sample.rejectionReason ? ` · rejected: ${escapeHtml(sample.rejectionReason)}` : ''}</li>`,
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(detail.requestNo)} laboratory report</title>
<style>
body{font-family:system-ui,sans-serif;color:#0f172a;padding:32px;max-width:900px;margin:0 auto}
h1{font-size:1.25rem;margin:0} h2{font-size:1rem;margin:24px 0 8px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#f1f5f9}
.meta{color:#475569;font-size:13px;margin:8px 0}
.banner{padding:8px 12px;border-radius:8px;margin:16px 0;font-size:13px}
.unassessed{background:#f1f5f9}
.amended{background:#fff7ed}
.incomplete{background:#fef2f2}
.flag-unassessed td:nth-child(5){background:#e2e8f0;font-weight:600}
.flag-normal td:nth-child(5){background:#ecfdf5}
.flag-abnormal td:nth-child(5){background:#fff7ed}
.flag-critical td:nth-child(5){background:#ffe4e6;font-weight:700}
.flag-unknown td:nth-child(5){background:#e2e8f0}
.comment,.value{white-space:pre-wrap;word-break:break-word}
</style></head><body>
<h1>${facility}</h1>
<p class="meta">Laboratory report · ${escapeHtml(detail.requestNo)} · Status: ${escapeHtml(detail.status)}</p>
<p class="meta">${escapeHtml(`${patient?.firstName ?? ''} ${patient?.lastName ?? ''}`.trim())} · ${escapeHtml(
    patient?.patientNo ?? '',
  )} · DOB ${escapeHtml(patient?.dateOfBirth ?? '—')} · ${escapeHtml(patient?.gender ?? '—')}</p>
${detail.status === 'cancelled' ? `<div class="banner amended">Cancelled${detail.cancelledReason ? `: ${escapeHtml(detail.cancelledReason)}` : ''}</div>` : ''}
${incomplete.length ? `<div class="banner incomplete">Incomplete panel — not a complete report. ${escapeHtml(incomplete.join('; '))}</div>` : ''}
<h2>Specimens</h2>
<ul>${samples || '<li>None recorded</li>'}</ul>
<h2>Results</h2>
<p class="meta unassessed">Unassessed means no applicable approved reference interval was used. It is not a normal result. Flags below are stored values, not a live catalogue recalculation.</p>
<table>
<thead><tr><th>Test</th><th>Parameter</th><th>Result</th><th>Reference interval</th><th>Flag</th><th>Status</th><th>Comment</th></tr></thead>
<tbody>${rows.join('') || '<tr><td colspan="7">No structured results</td></tr>'}</tbody>
</table>
<p class="meta">Verifier: ${escapeHtml(options?.verifierName || '—')}</p>
<p class="meta">This report is generated from stored laboratory results. Attachments are not a substitute for structured values.</p>
</body></html>`;
}
