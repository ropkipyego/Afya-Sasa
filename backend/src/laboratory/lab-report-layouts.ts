/**
 * Structural layouts for Jalaram official laboratory cards.
 * Units and reference intervals MUST come from the laboratory catalogue.
 * Interpretive remarks are hospital card wording, not another patient's results.
 */
export type LabLayoutParameter = {
  code: string
  label: string
  group: string
}

export type LabReportLayout = {
  title: string
  parameters: LabLayoutParameter[]
  remarks?: string[]
}

export const LAB_REPORT_LAYOUTS: Record<string, LabReportLayout> = {
  CBC: {
    title: 'Complete Blood Count',
    parameters: [
      { code: 'HGB', label: 'Haemoglobin (Hb)', group: 'Red cell' },
      { code: 'HCT', label: 'Packed cell volume (PCV)', group: 'Red cell' },
      { code: 'RBC', label: 'Red blood cells', group: 'Red cell' },
      { code: 'MCV', label: 'MCV', group: 'Red cell' },
      { code: 'MCH', label: 'MCH', group: 'Red cell' },
      { code: 'MCHC', label: 'MCHC', group: 'Red cell' },
      { code: 'RDW', label: 'RDW', group: 'Red cell' },
      { code: 'WBC', label: 'White blood cells', group: 'White cell' },
      { code: 'NEUT', label: 'Neutrophils %', group: 'Differential' },
      { code: 'LYMPH', label: 'Lymphocytes %', group: 'Differential' },
      { code: 'MONO', label: 'Monocytes %', group: 'Differential' },
      { code: 'EOS', label: 'Eosinophils %', group: 'Differential' },
      { code: 'BASO', label: 'Basophils %', group: 'Differential' },
      { code: 'NEUT#', label: 'Neutrophils #', group: 'Absolute' },
      { code: 'LYMPH#', label: 'Lymphocytes #', group: 'Absolute' },
      { code: 'MONO#', label: 'Monocytes #', group: 'Absolute' },
      { code: 'EOS#', label: 'Eosinophils #', group: 'Absolute' },
      { code: 'BASO#', label: 'Basophils #', group: 'Absolute' },
      { code: 'PLT', label: 'Platelets', group: 'Platelets' },
      { code: 'FILM', label: 'Blood film comment', group: 'Morphology' },
    ],
  },
  UEC: {
    title: 'Urea, Electrolytes and Creatinine',
    parameters: [
      { code: 'UREA', label: 'Urea', group: 'Renal' },
      { code: 'CREAT', label: 'Creatinine', group: 'Renal' },
      { code: 'NA', label: 'Sodium', group: 'Electrolytes' },
      { code: 'K', label: 'Potassium', group: 'Electrolytes' },
      { code: 'CL', label: 'Chloride', group: 'Electrolytes' },
      { code: 'EGFR', label: 'eGFR (CKD-EPI)', group: 'Renal' },
    ],
    remarks: [
      'eGFR staging on this card: ≥90 Stage 1; 60–89 Stage 2; 30–59 Stage 3; 15–29 Stage 4; <15 Stage 5 (CKD-EPI).',
      'Apply only the approved catalogue interval for the patient age and sex. Do not copy values from another report.',
    ],
  },
  LFT: {
    title: 'Liver Function Tests',
    parameters: [
      { code: 'TP', label: 'Total protein', group: 'Proteins' },
      { code: 'ALB', label: 'Albumin', group: 'Proteins' },
      { code: 'GLOB', label: 'Globulin', group: 'Proteins' },
      { code: 'AG', label: 'A/G ratio', group: 'Proteins' },
      { code: 'TBIL', label: 'Total bilirubin', group: 'Bilirubin' },
      { code: 'DBIL', label: 'Direct bilirubin', group: 'Bilirubin' },
      { code: 'IBIL', label: 'Indirect bilirubin', group: 'Bilirubin' },
      { code: 'AST', label: 'AST (SGOT)', group: 'Enzymes' },
      { code: 'ALT', label: 'ALT (SGPT)', group: 'Enzymes' },
      { code: 'ALP', label: 'ALP', group: 'Enzymes' },
      { code: 'GGT', label: 'GGT', group: 'Enzymes' },
    ],
  },
  CRP: {
    title: 'C-Reactive Protein',
    parameters: [{ code: 'CRP', label: 'CRP', group: 'Inflammation' }],
    remarks: [
      'Hospital card: values <10 mg/L are the conventional negative cut-off used on this form.',
      'Cardiovascular relative-risk bands on the printed card are interpretive, not a diagnosis.',
      'Infection interpretive bands on the printed card are interpretive, not a diagnosis.',
    ],
  },
  PSA: {
    title: 'Prostate Specific Antigen',
    parameters: [{ code: 'PSA', label: 'Total PSA', group: 'Tumour marker' }],
    remarks: [
      'Conventional total-PSA cut-off printed on the hospital card is 4.0 ng/mL (JAMA 1993 reference on the card).',
      'Clinical interpretation remains with the referring clinician.',
    ],
  },
  STOOL: {
    title: 'Stool analysis',
    parameters: [
      { code: 'STOOL_COL', label: 'Colour', group: 'Macroscopy' },
      { code: 'STOOL_CONS', label: 'Consistency', group: 'Macroscopy' },
      { code: 'STOOL_MUC', label: 'Mucus', group: 'Macroscopy' },
      { code: 'STOOL_BLD', label: 'Blood', group: 'Macroscopy' },
      { code: 'STOOL_PUS', label: 'Pus cells', group: 'Microscopy' },
      { code: 'STOOL_RBC', label: 'Red blood cells', group: 'Microscopy' },
      { code: 'STOOL_TROP', label: 'Trophozoites', group: 'Microscopy' },
      { code: 'STOOL_OVA', label: 'Ova', group: 'Microscopy' },
      { code: 'STOOL_CYST', label: 'Cysts', group: 'Microscopy' },
      { code: 'STOOL_FAT', label: 'Fat globules', group: 'Microscopy' },
      { code: 'STOOL_YEAST', label: 'Yeast cells', group: 'Microscopy' },
      { code: 'STOOL_STARCH', label: 'Starch cells', group: 'Microscopy' },
      { code: 'STOOL_OCC', label: 'Occult blood', group: 'Chemical' },
      { code: 'HPYLORI', label: 'H. pylori antigen', group: 'Antigen' },
    ],
  },
  'H.PYLORI': {
    title: 'H. pylori antigen',
    parameters: [{ code: 'HPYLORI', label: 'H. pylori antigen', group: 'Antigen' }],
  },
  HPYLORI: {
    title: 'H. pylori antigen',
    parameters: [{ code: 'HPYLORI', label: 'H. pylori antigen', group: 'Antigen' }],
  },
}

export function labLayoutStatus(code: string) {
  const layout = LAB_REPORT_LAYOUTS[code.toUpperCase()]
  if (!layout) {
    return { found: false, title: null as string | null, parameters: [] as LabLayoutParameter[] }
  }
  return { found: true, title: layout.title, parameters: layout.parameters }
}
