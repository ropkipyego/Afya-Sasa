export type FormularyStatus = 'hospital_formulary' | 'non_formulary';

export type PrescribingAvailabilityStatus =
  | 'available_for_prescribing'
  | 'inactive_in_formulary'
  | 'non_pharmaceutical_item'
  | 'restricted_formulary_item';

export type RegulatoryVerificationStatus =
  | 'ppb_registration_verified'
  | 'regulatory_status_unverified';

export type FormularyPolicyMetadata = {
  genericName?: string | null;
  brandName?: string | null;
  restricted?: boolean;
  restrictionNote?: string | null;
  allowedRoles?: string[];
  ppbRegistrationNo?: string | null;
  ppbVerified?: boolean;
};

export type EvaluatedFormularyItem = {
  formularyStatus: FormularyStatus;
  formularyStatusLabel: string;
  prescribingStatus: PrescribingAvailabilityStatus;
  prescribingStatusLabel: string;
  regulatoryStatus: RegulatoryVerificationStatus;
  regulatoryStatusLabel: string;
  ppbRegistrationNo: string | null;
  genericName: string | null;
  brandName: string | null;
  restricted: boolean;
  restrictionNote: string | null;
  allowedRoles: string[];
};

/**
 * Distinguishes:
 * 1. Hospital formulary inclusion (pharmaceutical catalogue item in demo.inventory_items)
 * 2. Prescribing availability in AfyaSasa (active vs inactive vs restricted vs non-pharmaceutical)
 * 3. Regulatory registration with the Pharmacy and Poisons Board (PPB) — NEVER assumed from catalogue inclusion.
 */
export function evaluateFormularyStatus(
  item: {
    category: string;
    active: boolean;
  },
  policy?: FormularyPolicyMetadata | null,
): EvaluatedFormularyItem {
  const isPharmaceutical = item.category === 'pharmaceutical';
  const formularyStatus: FormularyStatus = isPharmaceutical
    ? 'hospital_formulary'
    : 'non_formulary';
  const formularyStatusLabel = isPharmaceutical
    ? 'Hospital formulary'
    : 'Non-formulary supply item';

  const restricted = Boolean(policy?.restricted);
  const restrictionNote = policy?.restrictionNote?.trim() || null;
  const allowedRoles = Array.isArray(policy?.allowedRoles) ? policy!.allowedRoles : [];

  let prescribingStatus: PrescribingAvailabilityStatus;
  let prescribingStatusLabel: string;

  if (!isPharmaceutical) {
    prescribingStatus = 'non_pharmaceutical_item';
    prescribingStatusLabel = 'Not prescribable (non-pharmaceutical supply)';
  } else if (!item.active) {
    prescribingStatus = 'inactive_in_formulary';
    prescribingStatusLabel = 'Inactive in hospital formulary';
  } else if (restricted) {
    prescribingStatus = 'restricted_formulary_item';
    prescribingStatusLabel = restrictionNote
      ? `Restricted formulary medicine (${restrictionNote})`
      : 'Restricted formulary medicine';
  } else {
    prescribingStatus = 'available_for_prescribing';
    prescribingStatusLabel = 'Available for prescribing';
  }

  const ppbNo = policy?.ppbRegistrationNo?.trim() || null;
  const isPpbVerified = Boolean(ppbNo && policy?.ppbVerified === true);
  const regulatoryStatus: RegulatoryVerificationStatus = isPpbVerified
    ? 'ppb_registration_verified'
    : 'regulatory_status_unverified';
  const regulatoryStatusLabel = isPpbVerified
    ? `PPB registration verified (${ppbNo})`
    : 'PPB regulatory registration not recorded';

  return {
    formularyStatus,
    formularyStatusLabel,
    prescribingStatus,
    prescribingStatusLabel,
    regulatoryStatus,
    regulatoryStatusLabel,
    ppbRegistrationNo: isPpbVerified ? ppbNo : null,
    genericName: policy?.genericName?.trim() || null,
    brandName: policy?.brandName?.trim() || null,
    restricted,
    restrictionNote,
    allowedRoles,
  };
}

export function canActorPrescribeRestrictedItem(
  evaluated: Pick<EvaluatedFormularyItem, 'restricted' | 'allowedRoles'>,
  actorRoles?: string[] | null,
  actorPermissions?: string[] | null,
): boolean {
  if (!evaluated.restricted) return true;
  if ((actorPermissions ?? []).includes('settings:manage')) return true;
  const roles = new Set((actorRoles ?? []).map((r) => r.toLowerCase()));
  if (roles.has('consultant') || roles.has('superadmin') || roles.has('administrator')) {
    return true;
  }
  if (evaluated.allowedRoles.length > 0) {
    return evaluated.allowedRoles.some((r) => roles.has(r.toLowerCase()));
  }
  return false;
}
