const LABELS: Record<string, string> = {
  analgesic: 'Analgesic / NSAID',
  antibiotic: 'Antibiotic',
  antihistamine: 'Antihistamine',
  antimalarial: 'Antimalarial',
  antidiabetic: 'Antidiabetic',
  antihypertensive: 'Antihypertensive',
  cardiovascular: 'Cardiovascular',
  respiratory: 'Respiratory',
  gastrointestinal: 'Gastrointestinal',
  corticosteroid: 'Corticosteroid',
  vitamin_supplement: 'Vitamin / supplement',
  antiseptic: 'Antiseptic',
  infusion_fluid: 'Infusion / fluid',
  antifungal: 'Antifungal',
  antiviral: 'Antiviral',
  contraceptive: 'Contraceptive',
  psychotropic: 'Psychotropic / CNS',
  vaccine: 'Vaccine',
  medical_consumable: 'Consumable',
  other: 'Other',
}

export function drugClassLabel(value?: string | null) {
  if (!value) return 'Other'
  return LABELS[value] ?? value.replace(/_/g, ' ')
}
