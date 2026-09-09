export const SHA_IDENTIFICATION_TYPES = [
  'National ID',
  'ClientRegistry ID',
  'Birth Notification',
  'Birth Certificate',
  'Alien ID',
  'Refugee ID',
  'Mandate Number',
] as const;

export type ShaIdentificationType = (typeof SHA_IDENTIFICATION_TYPES)[number];

const INTERNAL_TO_SHA: Record<string, ShaIdentificationType> = {
  national_id: 'National ID',
  client_registry: 'ClientRegistry ID',
  birth_notification: 'Birth Notification',
  birth_certificate: 'Birth Certificate',
  alien_id: 'Alien ID',
  refugee_id: 'Refugee ID',
  mandate_number: 'Mandate Number',
};

export function toShaIdentificationType(value?: string | null): ShaIdentificationType | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if ((SHA_IDENTIFICATION_TYPES as readonly string[]).includes(trimmed)) {
    return trimmed as ShaIdentificationType;
  }
  return INTERNAL_TO_SHA[trimmed] ?? null;
}

export function isPomsfScheme(schemeName?: string | null) {
  const name = (schemeName ?? '').trim().toUpperCase();
  if (!name) return false;
  return name.startsWith('POMSF') || name === 'TSC' || name === 'USALAMA';
}

export function inferShaFund(schemeName?: string | null) {
  const name = (schemeName ?? '').toUpperCase();
  if (name.includes('ECCIF') || name.includes('EMERGENCY') || name.includes('CRITICAL')) {
    return 'ECCIF';
  }
  if (name.includes('UHC') || name.includes('PHF') || name.includes('PRIMARY')) {
    return 'PHF';
  }
  if (name.includes('POMSF') || name.includes('TSC') || name.includes('USALAMA') || name.includes('SHIF')) {
    return 'SHIF';
  }
  return undefined;
}
