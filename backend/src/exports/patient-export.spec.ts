import { sanitizePatientExportFields } from './patient-export';

describe('patient field export', () => {
  it('drops unknown fields and never includes passwords', () => {
    const fields = sanitizePatientExportFields(['patientNo', 'passwordHash', 'firstName', 'nope']);
    expect(fields).toEqual(['patientNo', 'firstName']);
    expect(fields.join(',')).not.toMatch(/password|token/i);
  });
});
