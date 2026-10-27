import { mapMedicationDispense, mapMedicationRequest, mapPatient } from './fhir-mapper';
import { validateMappedResource } from './fhir-validate';
import { FHIR_R4_VERSION, KENYA_CORE_IG_VERSION, KENYA_ECLAIMS_STATUS } from './kenya-core';

describe('Kenya Core FHIR mapper', () => {
  it('records published guide versions without claiming HIE connectivity', () => {
    expect(FHIR_R4_VERSION).toBe('4.0.1');
    expect(KENYA_CORE_IG_VERSION).toBe('1.0.0');
    expect(KENYA_ECLAIMS_STATUS).toBe('draft');
  });

  it('maps a complete synthetic patient', () => {
    const resource = mapPatient({
      id: 'p1',
      patientNo: 'SYN-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      gender: 'female',
      dateOfBirth: '1815-12-10',
    });
    const result = validateMappedResource(resource as unknown as Record<string, unknown>);
    expect(result.valid).toBe(true);
  });

  it('fails when required Patient fields are missing', () => {
    const resource = mapPatient({
      id: 'p2',
      patientNo: '',
      firstName: '',
      lastName: '',
      gender: '',
      dateOfBirth: '',
    });
    const result = validateMappedResource(resource as unknown as Record<string, unknown>);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path.includes('identifier'))).toBe(true);
  });

  it('maps and validates Kenya Core MedicationRequest and MedicationDispense', () => {
    const req = mapMedicationRequest({
      id: 'rx-1',
      orderNo: 'RX-2026-1',
      status: 'requested',
      priority: 'routine',
      patientId: 'p1',
      encounterId: 'enc-1',
      itemId: 'item-1',
      sku: 'PARA500',
      medicationName: 'Paracetamol 500mg tablet',
      dose: '1g',
      route: 'oral',
      frequency: 'TDS',
      duration: '3 days',
      quantity: 18,
      unit: 'tablet',
    });
    expect(validateMappedResource(req as unknown as Record<string, unknown>).valid).toBe(true);

    const badReq = mapMedicationRequest({
      id: 'rx-bad',
      orderNo: 'RX-BAD',
      status: 'requested',
      patientId: '',
      medicationName: '',
      quantity: 0,
    });
    expect(validateMappedResource(badReq as unknown as Record<string, unknown>).valid).toBe(false);

    const disp = mapMedicationDispense({
      id: 'disp-1',
      orderId: 'rx-1',
      status: 'dispensed',
      patientId: 'p1',
      itemId: 'item-1',
      sku: 'PARA500',
      medicationName: 'Paracetamol 500mg tablet',
      quantityDispensed: 18,
      unit: 'tablet',
    });
    expect(validateMappedResource(disp as unknown as Record<string, unknown>).valid).toBe(true);
  });
});
