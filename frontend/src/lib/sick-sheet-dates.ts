export function addInclusiveDays(startDate: string, daysOff: number): string {
  const start = new Date(`${startDate}T12:00:00`)
  start.setDate(start.getDate() + Math.max(daysOff, 1) - 1)
  return start.toISOString().slice(0, 10)
}

export function inclusiveDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000)
  return Math.max(diff + 1, 1)
}
