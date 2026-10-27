import { BadRequestException } from '@nestjs/common';

export function assertCriticalCareChartOpen(
  status: string | null | undefined,
  unit: 'ICU' | 'HDU',
) {
  if (status !== 'active') {
    throw new BadRequestException(
      `${unit} charting is closed after discharge, transfer or death. Re-open a new overlay if care continues.`,
    );
  }
}

export function isCriticalCareBed(
  bed: { type?: string | null; ward?: { type?: string | null } | null } | null | undefined,
  unit: 'icu' | 'hdu',
) {
  if (!bed) return false;
  const wardType = String(bed.ward?.type ?? '').toLowerCase();
  const bedType = String(bed.type ?? '').toLowerCase();
  return wardType === unit || bedType === unit;
}

export function assertCriticalCareBed(
  bed: { type?: string | null; ward?: { type?: string | null } | null } | null | undefined,
  unit: 'icu' | 'hdu',
) {
  if (!bed) return;
  if (!isCriticalCareBed(bed, unit)) {
    throw new BadRequestException(
      unit === 'icu'
        ? 'Select an ICU bed. A general ward bed cannot open an ICU overlay.'
        : 'Select an HDU bed. A general ward bed cannot open an HDU overlay.',
    );
  }
}
