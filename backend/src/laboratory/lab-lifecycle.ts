export const LAB_REQUEST_STATUSES = [
  'requested',
  'sample_collected',
  'processing',
  'resulted',
  'verified',
  'cancelled',
] as const;

export type LabRequestStatus = (typeof LAB_REQUEST_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<LabRequestStatus, LabRequestStatus[]> = {
  requested: ['sample_collected', 'cancelled'],
  sample_collected: ['processing', 'resulted', 'cancelled', 'sample_collected'],
  processing: ['resulted', 'verified', 'cancelled', 'processing'],
  resulted: ['verified', 'resulted', 'cancelled'],
  verified: [],
  cancelled: [],
};

export function assertLabTransition(from: string, to: LabRequestStatus, action: string) {
  const current = (LAB_REQUEST_STATUSES as readonly string[]).includes(from)
    ? (from as LabRequestStatus)
    : null;
  if (!current) {
    throw new Error(`Unknown laboratory request status: ${from}`);
  }
  if (current === to) return;
  if (!ALLOWED_TRANSITIONS[current].includes(to)) {
    throw new Error(`Cannot ${action} from ${current} to ${to}.`);
  }
}

export function isVerifiedStatus(status?: string | null) {
  return status === 'verified';
}

export function isTerminalStatus(status?: string | null) {
  return status === 'verified' || status === 'cancelled';
}

export const OPEN_LAB_REQUEST_STATUSES: LabRequestStatus[] = [
  'requested',
  'sample_collected',
  'processing',
  'resulted',
];

export type LabOrderIdentity = {
  testId?: string | null;
  panelId?: string | null;
  orderableTestId?: string | null;
  label: string;
  requestNo?: string;
};

export function duplicateOpenLabOrder(
  incoming: LabOrderIdentity[],
  existing: LabOrderIdentity[],
): LabOrderIdentity | null {
  for (const row of incoming) {
    const match = existing.find((open) => {
      if (row.testId && open.testId === row.testId) return true;
      if (row.orderableTestId && open.orderableTestId === row.orderableTestId) return true;
      if (row.panelId && !row.testId && !row.orderableTestId && open.panelId === row.panelId) {
        return true;
      }
      return false;
    });
    if (match) return { ...row, requestNo: match.requestNo };
  }
  return null;
}

export const LAB_AUDIT = {
  ORDER: 'LAB_ORDER',
  COLLECT: 'LAB_SAMPLE_COLLECT',
  RECEIVE: 'LAB_SAMPLE_RECEIVE',
  REJECT: 'LAB_SAMPLE_REJECT',
  ENTER: 'LAB_RESULT_ENTER',
  VERIFY: 'LAB_RESULT_VERIFY',
  CANCEL: 'LAB_REQUEST_CANCEL',
  AMEND: 'LAB_RESULT_AMEND',
  ATTACH: 'LAB_ATTACHMENT',
  REPORT: 'LAB_REPORT_RENDER',
  CRITICAL: 'LAB_CRITICAL_RESULT',
  REVIEW: 'LAB_RESULT_REVIEW',
} as const;
