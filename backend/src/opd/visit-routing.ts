export type CheckInDestination = 'doctor' | 'laboratory' | 'radiology';
export type VisitQueueKind = 'OPD' | 'LAB' | 'RAD';

const QUEUE_FOR_DESTINATION: Record<CheckInDestination, VisitQueueKind> = {
  doctor: 'OPD',
  laboratory: 'LAB',
  radiology: 'RAD',
};

/** Diagnostic visit types own their routing even if a client still sends destination=doctor. */
export function destinationsForCheckIn(
  visitType?: string | null,
  requestedDestination?: string | null,
): CheckInDestination[] {
  if (visitType === 'laboratory_only') return ['laboratory'];
  if (visitType === 'radiology_only') return ['radiology'];
  if (visitType === 'diagnostic') return ['laboratory', 'radiology'];
  if (
    requestedDestination === 'laboratory' ||
    requestedDestination === 'radiology' ||
    requestedDestination === 'doctor'
  ) {
    return [requestedDestination];
  }
  return ['doctor'];
}

export function queueTypesForDestinations(destinations: CheckInDestination[]): VisitQueueKind[] {
  return destinations.map((destination) => QUEUE_FOR_DESTINATION[destination]);
}
