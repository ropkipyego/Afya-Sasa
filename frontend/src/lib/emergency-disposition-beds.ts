export type DispositionBed = {
  id: string
  bedNo: string
  status?: string
  type?: string | null
  ward?: { name: string; type?: string | null } | null
}

export function bedsForEmergencyOutcome(beds: DispositionBed[], outcome: string) {
  const available = beds.filter((bed) => !bed.status || bed.status === 'available')
  if (outcome === 'transferred_icu') {
    return available.filter((bed) => bed.ward?.type === 'icu' || bed.type === 'icu')
  }
  if (outcome === 'transferred_hdu') {
    return available.filter((bed) => bed.ward?.type === 'hdu' || bed.type === 'hdu')
  }
  if (outcome === 'transferred_maternity') {
    return available.filter((bed) => bed.ward?.type === 'maternity' || bed.type === 'maternity')
  }
  return available
}
