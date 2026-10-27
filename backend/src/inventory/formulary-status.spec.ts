import {
  canActorPrescribeRestrictedItem,
  evaluateFormularyStatus,
} from './formulary-status';

describe('formulary vs prescribing availability vs PPB regulatory status', () => {
  it('marks an active pharmaceutical item as Hospital formulary and Available for prescribing, with unverified PPB status by default', () => {
    const res = evaluateFormularyStatus({ category: 'pharmaceutical', active: true });
    expect(res.formularyStatus).toBe('hospital_formulary');
    expect(res.formularyStatusLabel).toBe('Hospital formulary');
    expect(res.prescribingStatus).toBe('available_for_prescribing');
    expect(res.prescribingStatusLabel).toBe('Available for prescribing');
    expect(res.regulatoryStatus).toBe('regulatory_status_unverified');
    expect(res.regulatoryStatusLabel).toBe('PPB regulatory registration not recorded');
    expect(res.ppbRegistrationNo).toBeNull();
  });

  it('never claims PPB registration is verified unless both ppbRegistrationNo and ppbVerified=true are present', () => {
    const unverifiedWithNumber = evaluateFormularyStatus(
      { category: 'pharmaceutical', active: true },
      { ppbRegistrationNo: 'PPB-CTD-12345', ppbVerified: false },
    );
    expect(unverifiedWithNumber.regulatoryStatus).toBe('regulatory_status_unverified');
    expect(unverifiedWithNumber.ppbRegistrationNo).toBeNull();

    const verified = evaluateFormularyStatus(
      { category: 'pharmaceutical', active: true },
      { ppbRegistrationNo: 'H2026/12345', ppbVerified: true, genericName: 'Paracetamol' },
    );
    expect(verified.regulatoryStatus).toBe('ppb_registration_verified');
    expect(verified.regulatoryStatusLabel).toBe('PPB registration verified (H2026/12345)');
    expect(verified.ppbRegistrationNo).toBe('H2026/12345');
    expect(verified.genericName).toBe('Paracetamol');
  });

  it('distinguishes inactive formulary items and non-pharmaceutical supplies from prescribable medicines', () => {
    const inactive = evaluateFormularyStatus({ category: 'pharmaceutical', active: false });
    expect(inactive.formularyStatus).toBe('hospital_formulary');
    expect(inactive.prescribingStatus).toBe('inactive_in_formulary');

    const consumable = evaluateFormularyStatus({ category: 'medical_consumable', active: true });
    expect(consumable.formularyStatus).toBe('non_formulary');
    expect(consumable.prescribingStatus).toBe('non_pharmaceutical_item');
  });

  it('enforces restricted formulary policy by role', () => {
    const restricted = evaluateFormularyStatus(
      { category: 'pharmaceutical', active: true },
      { restricted: true, restrictionNote: 'Reserve carbapenem — consultant only', allowedRoles: ['consultant'] },
    );
    expect(restricted.prescribingStatus).toBe('restricted_formulary_item');
    expect(canActorPrescribeRestrictedItem(restricted, ['doctor'], ['pharmacy:prescribe'])).toBe(false);
    expect(canActorPrescribeRestrictedItem(restricted, ['consultant'], ['pharmacy:prescribe'])).toBe(true);
  });
});
