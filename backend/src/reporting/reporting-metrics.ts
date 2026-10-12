export function sumCountSeries(series: Array<{ count: number }>) {
  return series.reduce((sum, point) => sum + point.count, 0);
}

export function occupancyPercent(occupied: number, total: number): number | null {
  if (!Number.isFinite(occupied) || !Number.isFinite(total) || total <= 0) return null;
  return Math.round((occupied / total) * 100);
}

export function compareDelta(current: number, previous: number) {
  const delta = current - previous;
  const percent =
    previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null;
  return { current, previous, delta, percent };
}
