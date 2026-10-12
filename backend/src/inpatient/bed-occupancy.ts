export function bedClaimSucceeded(affected: number | null | undefined) {
  return Number(affected ?? 0) > 0;
}

export function bedBlockedByActiveAdmission(existingActiveAdmissionId: string | null | undefined) {
  return Boolean(existingActiveAdmissionId);
}
