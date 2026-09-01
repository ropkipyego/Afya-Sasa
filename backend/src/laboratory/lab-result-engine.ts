import type {
  CalculatedFormula,
  DerivedResult,
  FlaggedResult,
  ParameterResultInput,
  PatientDemographics,
  ResultFlag,
  SeedReferenceRange,
} from './lab-catalog.types';

function toNumber(value: number | string | boolean | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickReferenceRange(
  ranges: SeedReferenceRange[],
  patient: PatientDemographics,
): SeedReferenceRange | null {
  const matching = ranges.filter((range) => {
    if (range.gender !== 'ALL' && range.gender !== patient.gender) return false;
    if (range.ageMinDays !== undefined && patient.ageDays < range.ageMinDays) return false;
    if (range.ageMaxDays !== undefined && patient.ageDays > range.ageMaxDays) return false;
    return true;
  });

  if (!matching.length) return null;

  return matching.sort((a, b) => {
    const specificityA =
      (a.gender === 'ALL' ? 0 : 1) +
      (a.ageMinDays !== undefined ? 1 : 0) +
      (a.ageMaxDays !== undefined ? 1 : 0);
    const specificityB =
      (b.gender === 'ALL' ? 0 : 1) +
      (b.ageMinDays !== undefined ? 1 : 0) +
      (b.ageMaxDays !== undefined ? 1 : 0);
    return specificityB - specificityA;
  })[0];
}

export function calculateEgfrCkdEpi(
  creatinineUmolL: number,
  ageYears: number,
  gender: 'M' | 'F',
): number | null {
  const scrMgDl = creatinineUmolL / 88.4;
  if (scrMgDl <= 0 || ageYears <= 0) return null;

  const kappa = gender === 'F' ? 0.7 : 0.9;
  const alpha = gender === 'F' ? -0.241 : -0.302;
  const sexFactor = gender === 'F' ? 1.012 : 1;
  const ratio = scrMgDl / kappa;
  const minTerm = Math.min(ratio, 1) ** alpha;
  const maxTerm = Math.max(ratio, 1) ** -1.2;

  return Math.round(142 * minTerm * maxTerm * 0.9938 ** ageYears * sexFactor);
}

export function calculateLdlFriedewaldMmol(
  totalCholesterol: number,
  hdl: number,
  triglycerides: number,
): number | null {
  if (triglycerides > 4.5) return null;
  const ldl = totalCholesterol - hdl - triglycerides / 2.2;
  return ldl > 0 ? Math.round(ldl * 100) / 100 : null;
}

export function calculateAgRatio(albumin: number, totalProtein: number): number | null {
  const globulin = totalProtein - albumin;
  if (globulin <= 0) return null;
  return Math.round((albumin / globulin) * 100) / 100;
}

export function calculateIndirectBilirubin(total: number, direct: number): number | null {
  const indirect = total - direct;
  return indirect >= 0 ? Math.round(indirect * 10) / 10 : null;
}

export function calculateGlobulin(totalProtein: number, albumin: number): number | null {
  const globulin = totalProtein - albumin;
  return globulin >= 0 ? Math.round(globulin * 10) / 10 : null;
}

export function calculateSaag(serumAlbumin: number, asciticAlbumin: number): number | null {
  return Math.round((serumAlbumin - asciticAlbumin) * 10) / 10;
}

export function calculateTransferrinSaturation(iron: number, tibc: number): number | null {
  if (tibc <= 0) return null;
  return Math.round((iron / tibc) * 1000) / 10;
}

const FORMULA_RESOLVERS: Record<
  CalculatedFormula,
  (values: Map<string, number>, patient: PatientDemographics) => DerivedResult | null
> = {
  ag_ratio: (values) => {
    const albumin = values.get('ALB');
    const totalProtein = values.get('TP');
    if (albumin === undefined || totalProtein === undefined) return null;
    const value = calculateAgRatio(albumin, totalProtein);
    return value === null ? null : { parameterCode: 'AG_RATIO', value, unit: 'ratio' };
  },
  globulin: (values) => {
    const albumin = values.get('ALB');
    const totalProtein = values.get('TP');
    if (albumin === undefined || totalProtein === undefined) return null;
    const value = calculateGlobulin(totalProtein, albumin);
    return value === null ? null : { parameterCode: 'GLOB', value, unit: 'g/L' };
  },
  indirect_bilirubin: (values) => {
    const total = values.get('TBIL');
    const direct = values.get('DBIL');
    if (total === undefined || direct === undefined) return null;
    const value = calculateIndirectBilirubin(total, direct);
    return value === null ? null : { parameterCode: 'IBIL', value, unit: 'µmol/L' };
  },
  egfr_ckd_epi: (values, patient) => {
    const creatinine = values.get('CREAT');
    if (creatinine === undefined) return null;
    const value = calculateEgfrCkdEpi(creatinine, patient.ageDays / 365.25, patient.gender);
    return value === null ? null : { parameterCode: 'EGFR', value, unit: 'mL/min/1.73m²' };
  },
  ldl_friedewald: (values) => {
    const tc = values.get('CHOL');
    const hdl = values.get('HDL');
    const tg = values.get('TG');
    if (tc === undefined || hdl === undefined || tg === undefined) return null;
    const value = calculateLdlFriedewaldMmol(tc, hdl, tg);
    return value === null ? null : { parameterCode: 'LDL', value, unit: 'mmol/L' };
  },
  saag: (values) => {
    const serumAlb = values.get('ALB');
    const asciticAlb = values.get('ASC_ALB');
    if (serumAlb === undefined || asciticAlb === undefined) return null;
    const value = calculateSaag(serumAlb, asciticAlb);
    return value === null ? null : { parameterCode: 'SAAG', value, unit: 'g/L' };
  },
  transferrin_saturation: (values) => {
    const iron = values.get('FE');
    const tibc = values.get('TIBC');
    if (iron === undefined || tibc === undefined) return null;
    const value = calculateTransferrinSaturation(iron, tibc);
    return value === null ? null : { parameterCode: 'TSAT', value, unit: '%' };
  },
};

export function calculateDerivedResults(
  inputs: ParameterResultInput[],
  formulas: Array<{ parameterCode: string; formula: CalculatedFormula }>,
  patient: PatientDemographics,
): DerivedResult[] {
  const numericValues = new Map<string, number>();
  for (const input of inputs) {
    const numeric = toNumber(input.value);
    if (numeric !== null) numericValues.set(input.parameterCode, numeric);
  }

  const derived: DerivedResult[] = [];
  for (const item of formulas) {
    const resolver = FORMULA_RESOLVERS[item.formula];
    const result = resolver(numericValues, patient);
    if (result) {
      derived.push(result);
      numericValues.set(result.parameterCode, result.value);
    }
  }
  return derived;
}

export function flagResult(
  value: number | string | boolean,
  ranges: SeedReferenceRange[],
  patient: PatientDemographics,
): { flag: ResultFlag; referenceRangeLabel?: string } {
  const matched = pickReferenceRange(ranges, patient);
  if (!matched) return { flag: 'NORMAL' };

  if (typeof value === 'string' || typeof value === 'boolean') {
    const textValue = typeof value === 'boolean' ? (value ? 'Positive' : 'Negative') : value;
    if (matched.normalTextValue && textValue.toLowerCase() !== matched.normalTextValue.toLowerCase()) {
      return { flag: 'HIGH', referenceRangeLabel: matched.normalTextValue };
    }
    return { flag: 'NORMAL', referenceRangeLabel: matched.normalTextValue ?? undefined };
  }

  const numeric = toNumber(value);
  if (numeric === null) return { flag: 'NORMAL' };

  const { rangeLow, rangeHigh, criticalLow, criticalHigh } = matched;
  const label =
    rangeLow !== undefined && rangeHigh !== undefined ? `${rangeLow}-${rangeHigh}` : undefined;

  if (criticalLow !== undefined && numeric <= criticalLow) {
    return { flag: 'CRITICAL', referenceRangeLabel: label };
  }
  if (criticalHigh !== undefined && numeric >= criticalHigh) {
    return { flag: 'CRITICAL', referenceRangeLabel: label };
  }
  if (rangeLow !== undefined && numeric < rangeLow) {
    return { flag: 'LOW', referenceRangeLabel: label };
  }
  if (rangeHigh !== undefined && numeric > rangeHigh) {
    return { flag: 'HIGH', referenceRangeLabel: label };
  }

  return { flag: 'NORMAL', referenceRangeLabel: label };
}

export function flagResultsForPatient(
  results: ParameterResultInput[],
  catalog: Array<{
    parameterCode: string;
    referenceRanges: SeedReferenceRange[];
  }>,
  patient: PatientDemographics,
): FlaggedResult[] {
  const rangeByCode = new Map(catalog.map((entry) => [entry.parameterCode, entry.referenceRanges]));

  return results.map((result) => {
    const ranges = rangeByCode.get(result.parameterCode) ?? [];
    const { flag, referenceRangeLabel } = flagResult(result.value, ranges, patient);
    return {
      parameterCode: result.parameterCode,
      value: result.value,
      flag,
      referenceRangeLabel,
    };
  });
}

export function mapFlagToLegacyResultFlag(
  flag: ResultFlag,
): 'normal' | 'low' | 'high' | 'critically_low' | 'critically_high' {
  switch (flag) {
    case 'LOW':
      return 'low';
    case 'HIGH':
      return 'high';
    case 'CRITICAL':
      return 'critically_high';
    default:
      return 'normal';
  }
}

export function resolveLegacyResultFlag(
  flag: ResultFlag,
  value: number | string | boolean,
  ranges: SeedReferenceRange[],
  patient: PatientDemographics,
): 'normal' | 'low' | 'high' | 'critically_low' | 'critically_high' {
  if (flag !== 'CRITICAL') return mapFlagToLegacyResultFlag(flag);
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 'critically_high';
  const matched = pickReferenceRange(ranges, patient);
  if (matched?.criticalLow !== undefined && numeric <= matched.criticalLow) {
    return 'critically_low';
  }
  return 'critically_high';
}
