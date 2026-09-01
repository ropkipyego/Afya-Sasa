export type ResultDataType = 'numeric' | 'boolean' | 'text' | 'select_options';

export type ReferenceGender = 'M' | 'F' | 'ALL';

export type ResultFlag = 'NORMAL' | 'LOW' | 'HIGH' | 'CRITICAL';

export type CalculatedFormula =
  | 'ag_ratio'
  | 'indirect_bilirubin'
  | 'globulin'
  | 'egfr_ckd_epi'
  | 'ldl_friedewald'
  | 'saag'
  | 'transferrin_saturation';

export type SeedReferenceRange = {
  gender: ReferenceGender;
  ageMinDays?: number;
  ageMaxDays?: number;
  rangeLow?: number;
  rangeHigh?: number;
  criticalLow?: number;
  criticalHigh?: number;
  normalTextValue?: string;
};

export type SeedParameter = {
  code: string;
  name: string;
  unit?: string;
  resultDataType: ResultDataType;
  selectOptions?: string[];
  orderIndex: number;
  calculatedFormula?: CalculatedFormula;
  referenceRanges: SeedReferenceRange[];
};

export type SeedOrderableTest = {
  code: string;
  name: string;
  departmentCode: string;
  specimenCode: string;
  isPanel: boolean;
  standardTatMinutes: number;
  parameters?: SeedParameter[];
};

export type SeedDepartment = {
  code: string;
  name: string;
};

export type SeedSpecimenType = {
  code: string;
  name: string;
  containerDescription: string;
  additive?: string;
  color?: string;
};

export type PatientDemographics = {
  gender: 'M' | 'F';
  ageDays: number;
};

export type ParameterResultInput = {
  parameterCode: string;
  value: number | string | boolean;
};

export type DerivedResult = {
  parameterCode: string;
  value: number;
  unit?: string;
};

export type FlaggedResult = {
  parameterCode: string;
  value: number | string | boolean;
  flag: ResultFlag;
  referenceRangeLabel?: string;
};
