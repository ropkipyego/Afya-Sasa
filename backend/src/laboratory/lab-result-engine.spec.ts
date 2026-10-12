import {
  calculateAgRatio,
  calculateDerivedResults,
  calculateEgfrCkdEpi,
  calculateIndirectBilirubin,
  calculateLdlFriedewaldMmol,
  calculateSaag,
  flagResult,
  mapFlagToLegacyResultFlag,
  mapPatientToRangeDemographics,
  normalizeRangeDemographics,
  pickReferenceRange,
} from './lab-result-engine';

describe('lab-result-engine', () => {
  it('calculates CKD-EPI eGFR for adult male', () => {
    const egfr = calculateEgfrCkdEpi(88.4, 45, 'M');
    expect(egfr).not.toBeNull();
    expect(egfr!).toBeGreaterThan(60);
  });

  it('calculates Friedewald LDL in mmol/L', () => {
    expect(calculateLdlFriedewaldMmol(5.0, 1.2, 1.5)).toBeCloseTo(3.12, 1);
    expect(calculateLdlFriedewaldMmol(5.0, 1.2, 5.0)).toBeNull();
  });

  it('calculates A/G ratio and indirect bilirubin', () => {
    expect(calculateAgRatio(40, 70)).toBeCloseTo(1.33, 1);
    expect(calculateIndirectBilirubin(15, 4)).toBe(11);
  });

  it('calculates SAAG', () => {
    expect(calculateSaag(30, 10)).toBe(20);
  });

  it('flags numeric results by gender-specific range', () => {
    const ranges = [
      { gender: 'M' as const, rangeLow: 13, rangeHigh: 17, criticalLow: 7 },
      { gender: 'F' as const, rangeLow: 12, rangeHigh: 15, criticalLow: 7 },
    ];
    expect(flagResult(14, ranges, { gender: 'M', ageDays: 12000 }).flag).toBe('NORMAL');
    expect(flagResult(11, ranges, { gender: 'M', ageDays: 12000 }).flag).toBe('LOW');
    expect(flagResult(6, ranges, { gender: 'F', ageDays: 12000 }).flag).toBe('CRITICAL');
  });

  it('flags pediatric haemoglobin separately from adult', () => {
    const ranges = [
      { gender: 'ALL' as const, ageMinDays: 0, ageMaxDays: 365, rangeLow: 10, rangeHigh: 14 },
      { gender: 'ALL' as const, ageMinDays: 366, ageMaxDays: 4380, rangeLow: 11, rangeHigh: 14 },
      { gender: 'M' as const, rangeLow: 13, rangeHigh: 17 },
    ];
    expect(flagResult(10.5, ranges, { gender: 'M', ageDays: 200 }).flag).toBe('NORMAL');
    expect(flagResult(12, ranges, { gender: 'M', ageDays: 5000 }).flag).toBe('LOW');
  });

  it('derives LFT calculated parameters', () => {
    const derived = calculateDerivedResults(
      [
        { parameterCode: 'TBIL', value: 20 },
        { parameterCode: 'DBIL', value: 6 },
        { parameterCode: 'ALB', value: 40 },
        { parameterCode: 'TP', value: 70 },
      ],
      [
        { parameterCode: 'IBIL', formula: 'indirect_bilirubin' },
        { parameterCode: 'GLOB', formula: 'globulin' },
        { parameterCode: 'AG_RATIO', formula: 'ag_ratio' },
      ],
      { gender: 'M', ageDays: 12000 },
    );

    expect(derived.find((item) => item.parameterCode === 'IBIL')?.value).toBe(14);
    expect(derived.find((item) => item.parameterCode === 'GLOB')?.value).toBe(30);
    expect(derived.find((item) => item.parameterCode === 'AG_RATIO')?.value).toBeCloseTo(1.33, 1);
  });

  it('maps catalog flags to legacy result flags', () => {
    expect(mapFlagToLegacyResultFlag('NORMAL')).toBe('normal');
    expect(mapFlagToLegacyResultFlag('CRITICAL')).toBe('critically_high');
    expect(mapFlagToLegacyResultFlag('UNASSESSED')).toBe('unassessed');
  });

  it('does not flag NORMAL when no reference interval matches', () => {
    const flagged = flagResult(14, [], { gender: 'M', ageDays: 12000 });
    expect(flagged.flag).toBe('UNASSESSED');
    expect(flagged.flag).not.toBe('NORMAL');
    expect(flagged.referenceRangeLabel).toBe('Not established');
  });

  it('does not replace a missing date of birth with an assumed age', () => {
    const mapped = mapPatientToRangeDemographics({ gender: 'male' });
    expect(mapped.ageDays).toBeNull();
    expect(mapped.gender).toBe('M');
  });

  it('does not convert unknown or unsupported sex to female', () => {
    expect(mapPatientToRangeDemographics({ gender: 'unknown' }).gender).toBe('UNKNOWN');
    expect(mapPatientToRangeDemographics({ gender: 'intersex' }).gender).toBe('UNKNOWN');
    expect(mapPatientToRangeDemographics({ gender: null }).gender).toBe('UNKNOWN');
    expect(normalizeRangeDemographics({ gender: 'UNKNOWN', ageDays: 400 }).gender).toBe('UNKNOWN');
  });

  it('does not select a sex-specific range when sex is unknown', () => {
    const ranges = [
      { gender: 'M' as const, rangeLow: 13, rangeHigh: 17 },
      { gender: 'F' as const, rangeLow: 12, rangeHigh: 15 },
    ];
    expect(pickReferenceRange(ranges, { gender: 'UNKNOWN', ageDays: 12000 })).toBeNull();
    expect(flagResult(14, ranges, { gender: 'UNKNOWN', ageDays: 12000 }).flag).toBe('UNASSESSED');
  });

  it('does not select an age-bounded range when date of birth is missing', () => {
    const ranges = [
      { gender: 'ALL' as const, ageMinDays: 0, ageMaxDays: 365, rangeLow: 10, rangeHigh: 14 },
    ];
    expect(pickReferenceRange(ranges, { gender: 'M', ageDays: null })).toBeNull();
    expect(flagResult(12, ranges, { gender: 'M', ageDays: null }).flag).toBe('UNASSESSED');
  });

  it('still flags NORMAL when an ALL-age range applies without sex', () => {
    const ranges = [{ gender: 'ALL' as const, rangeLow: 4, rangeHigh: 11 }];
    expect(flagResult(7, ranges, { gender: 'UNKNOWN', ageDays: null }).flag).toBe('NORMAL');
  });

  it('maps unknown flags to unassessed rather than normal', () => {
    expect(mapFlagToLegacyResultFlag('unsupported')).toBe('unassessed');
  });

  it('returns no range when equally specific intervals conflict', () => {
    expect(
      pickReferenceRange(
        [
          { gender: 'M' as const, rangeLow: 13, rangeHigh: 17 },
          { gender: 'M' as const, rangeLow: 12, rangeHigh: 16 },
        ],
        { gender: 'M', ageDays: 12000 },
      ),
    ).toBeNull();
  });

  it('does not calculate eGFR without sex and age', () => {
    const missing = calculateDerivedResults(
      [{ parameterCode: 'CREAT', value: 88.4 }],
      [{ parameterCode: 'EGFR', formula: 'egfr_ckd_epi' }],
      { gender: 'UNKNOWN', ageDays: null },
    );
    expect(missing.find((row) => row.parameterCode === 'EGFR')).toBeUndefined();
  });
});
