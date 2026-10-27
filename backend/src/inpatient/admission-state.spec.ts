import { BadRequestException } from '@nestjs/common';
import { assertActiveAdmission } from './admission-state';

describe('assertActiveAdmission', () => {
  it('allows an active admission', () => {
    expect(() => assertActiveAdmission('active', 'transfer the patient')).not.toThrow();
  });

  it('blocks transfer and charting after discharge', () => {
    expect(() => assertActiveAdmission('discharged', 'transfer the patient')).toThrow(BadRequestException);
    expect(() => assertActiveAdmission('discharged', 'transfer the patient')).toThrow(
      /Cannot transfer the patient on a discharged admission/,
    );
  });

  it('blocks cancelled admissions', () => {
    expect(() => assertActiveAdmission('cancelled', 'record a MAR entry')).toThrow(/cancelled admission/);
  });
});
