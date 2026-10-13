import { mapPatient } from './fhir-mapper';
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
});
