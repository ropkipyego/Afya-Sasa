import type { SeedDepartment, SeedSpecimenType } from '../lab-catalog.types';

export const KENYA_LAB_DEPARTMENTS: SeedDepartment[] = [
  { code: 'HEM', name: 'Hematology' },
  { code: 'CC', name: 'Clinical Chemistry' },
  { code: 'MIC', name: 'Microbiology' },
  { code: 'SER', name: 'Serology/Immunology' },
  { code: 'BT', name: 'Blood Transfusion' },
  { code: 'HCY', name: 'Histology/Cytology' },
  { code: 'MOL', name: 'Molecular Biology' },
];

export const KENYA_LAB_SPECIMENS: SeedSpecimenType[] = [
  {
    code: 'EDTA-PURPLE',
    name: 'EDTA - Purple Top',
    containerDescription: 'Vacutainer EDTA tube',
    additive: 'K2EDTA',
    color: 'Purple',
  },
  {
    code: 'SST-YELLOW',
    name: 'Serum Separator - Yellow Top',
    containerDescription: 'Serum separator tube with gel',
    additive: 'Silica clot activator / gel',
    color: 'Yellow',
  },
  {
    code: 'FL-OX-GREY',
    name: 'Fluoride Oxalate - Grey Top',
    containerDescription: 'Fluoride/oxalate tube for glucose',
    additive: 'Sodium fluoride / potassium oxalate',
    color: 'Grey',
  },
  {
    code: 'CIT-BLUE',
    name: 'Citrate - Blue Top',
    containerDescription: 'Sodium citrate tube (9:1)',
    additive: '3.2% sodium citrate',
    color: 'Blue',
  },
  {
    code: 'PLAIN-RED',
    name: 'Plain - Red Top',
    containerDescription: 'Plain clot activator tube',
    additive: 'Clot activator',
    color: 'Red',
  },
  {
    code: 'URINE',
    name: 'Urine - Sterile Container',
    containerDescription: 'Clean-catch midstream urine container',
    color: 'Clear',
  },
  {
    code: 'STOOL',
    name: 'Stool - Universal Container',
    containerDescription: 'Stool specimen container with spoon',
    color: 'White',
  },
  {
    code: 'CSF',
    name: 'CSF - Sterile Tube',
    containerDescription: 'Sterile CSF collection tube',
    color: 'Clear',
  },
  {
    code: 'ABG-SYRINGE',
    name: 'Arterial Blood Gas Syringe',
    containerDescription: 'Heparinized arterial blood gas syringe',
    additive: 'Dry balanced heparin',
    color: 'Clear',
  },
  {
    code: 'SWAB',
    name: 'Swab - Transport Medium',
    containerDescription: 'Amies/VTM swab transport system',
    color: 'Clear',
  },
  {
    code: 'ASCITIC',
    name: 'Ascitic Fluid - Sterile Container',
    containerDescription: 'Sterile fluid container',
    color: 'Clear',
  },
  {
    code: 'SLIDE',
    name: 'Microscopy Slide',
    containerDescription: 'Glass slide with cover slip',
    color: 'Clear',
  },
  {
    code: 'TISSUE',
    name: 'Tissue Specimen',
    containerDescription: 'Formalin-fixed tissue container',
    additive: '10% neutral buffered formalin',
    color: 'Clear',
  },
];
