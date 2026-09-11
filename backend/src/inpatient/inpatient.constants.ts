/**
 * Canonical inpatient catalogues.
 *
 * Bed statuses:
 * - available, occupied, reserved, maintenance, inactive — operational set
 * - occupied is produced by admission / transfer, never by PATCH /beds/:id/status
 * - cleaning is retained for compatibility: production demo.beds currently stores it
 *   as housekeeping. It is not migrated to maintenance in this phase.
 */
export const WARD_TYPES = [
  'general',
  'icu',
  'hdu',
  'maternity',
  'paediatric',
  'surgical',
  'medical',
  'isolation',
] as const;

export type WardType = (typeof WARD_TYPES)[number];

export const BED_TYPES = [
  'standard',
  'icu',
  'isolation',
  'paediatric',
  'maternity',
  'cardiac',
] as const;

export type BedType = (typeof BED_TYPES)[number];

export const BED_STATUSES = [
  'available',
  'occupied',
  'reserved',
  'maintenance',
  'inactive',
  'cleaning',
] as const;

export type BedStatus = (typeof BED_STATUSES)[number];

/** Statuses staff may set directly. Occupied is admission-driven. */
export const BED_STATUSES_SETTABLE = [
  'available',
  'reserved',
  'maintenance',
  'inactive',
  'cleaning',
] as const;

export type SettableBedStatus = (typeof BED_STATUSES_SETTABLE)[number];
