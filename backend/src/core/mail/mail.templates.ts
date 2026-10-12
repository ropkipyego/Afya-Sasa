const HOSPITAL = 'Jalaram Hospital';
const PRODUCT = 'AfyaSasa EMR';

function wrap(title: string, paragraphs: string[]): { subject: string; text: string; html: string } {
  const text = [`${HOSPITAL} — ${PRODUCT}`, title, '', ...paragraphs, '', `This message was sent by ${HOSPITAL}.`].join(
    '\n',
  );
  const html = `<div style="font-family:Georgia,serif;max-width:560px;color:#1e293b">
  <p style="margin:0 0 4px;letter-spacing:.18em;font-size:11px;color:#0f766e;text-transform:uppercase">${HOSPITAL}</p>
  <h1 style="margin:0 0 16px;font-size:20px">${title}</h1>
  ${paragraphs.map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`).join('')}
  <p style="font-size:12px;color:#64748b">This message was sent by ${HOSPITAL} ${PRODUCT}. Do not reply with passwords or patient records.</p>
</div>`;
  return { subject: `${HOSPITAL}: ${title}`, text, html };
}

export function passwordResetTemplate(resetUrl: string, expiresMinutes: number) {
  return wrap('Password reset', [
    `A password reset was requested for your ${PRODUCT} staff account.`,
    `Open this link within ${expiresMinutes} minutes to choose a new password: ${resetUrl}`,
    'If you did not request this, ignore this email. Your current password stays unchanged.',
  ]);
}

export function passwordChangedTemplate() {
  return wrap('Password changed', [
    `The password on your ${PRODUCT} staff account was changed.`,
    'If you made this change, no further action is needed.',
    'If you did not change your password, contact hospital IT immediately. This message does not contain your password.',
  ]);
}

export function internalReportTemplate(input: {
  reportType: string;
  rangeLabel: string;
  viewUrl: string;
  requesterEmail: string;
}) {
  return wrap('Internal report available', [
    `An authorised internal report (${input.reportType}) is ready for ${input.rangeLabel}.`,
    `Requested by ${input.requesterEmail}.`,
    `Open this expiring hospital link while signed in: ${input.viewUrl}`,
    'This email does not attach patient-level records.',
  ]);
}

export function systemAlertTemplate(input: { title: string; detail: string }) {
  return wrap('System alert', [
    input.title,
    input.detail,
    'Do not include patient identifiers when forwarding this alert.',
  ]);
}

export function governmentNotificationTemplate(input: {
  kind: 'failure' | 'acknowledgement';
  integration: string;
  detail: string;
}) {
  const title =
    input.kind === 'acknowledgement'
      ? `${input.integration} notification`
      : `${input.integration} integration failure`;
  const extra =
    input.kind === 'acknowledgement'
      ? 'This is not a submission receipt. Use the official authority portal or API for statutory reporting.'
      : 'This is not an acknowledgement of any government submission. Complete required reporting in the official portal.';
  return wrap(title, [input.detail, extra]);
}
