export type IntelligenceFinding = {
  title: string;
  detail: string;
  metric: string;
  current: number;
  baseline: number;
  period: string;
  source: string;
  severity: 'info' | 'watch';
};

export function compareAgainstBaseline(
  metric: string,
  current: number,
  previous: number,
  period: string,
  source: string,
): IntelligenceFinding | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  const delta = (current - previous) / previous;
  if (Math.abs(delta) < 0.35) return null;
  const direction = delta < 0 ? 'below' : 'above';
  return {
    title: `${metric} is ${direction} the recent baseline`,
    detail: `${metric} is ${formatNumber(current)} compared with a recent average of ${formatNumber(previous)} for ${period}.`,
    metric,
    current,
    baseline: previous,
    period,
    source,
    severity: Math.abs(delta) >= 0.6 ? 'watch' : 'info',
  };
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
