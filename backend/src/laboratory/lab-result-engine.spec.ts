import {
  calculateAgRatio,
  calculateDerivedResults,
  calculateEgfrCkdEpi,
  calculateIndirectBilirubin,
  calculateLdlFriedewaldMmol,
  calculateSaag,
  flagResult,
  mapFlagToLegacyResultFlag,
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
  });
});
