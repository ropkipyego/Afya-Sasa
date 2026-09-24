export const DRUG_CLASSES = [
  'analgesic',
  'antibiotic',
  'antihistamine',
  'antimalarial',
  'antidiabetic',
  'antihypertensive',
  'cardiovascular',
  'respiratory',
  'gastrointestinal',
  'corticosteroid',
  'vitamin_supplement',
  'antiseptic',
  'infusion_fluid',
  'antifungal',
  'antiviral',
  'contraceptive',
  'psychotropic',
  'vaccine',
  'medical_consumable',
  'other',
] as const;

export type DrugClass = (typeof DRUG_CLASSES)[number];

const RULES: Array<{ cls: DrugClass; match: RegExp }> = [
  { cls: 'antibiotic', match: /\b(amoxicillin|amoxil|ampicillin|flucloxacillin|fluclox|cloxacillin|co-?amoxiclav|augmentin|ceftriaxone|rocephin|cefuroxime|zinacef|cefixime|cefalexin|azithromycin|erythromycin|clarithromycin|ciprofloxacin|cipro|levofloxacin|metronidazole|flagyl|tinidazole|doxycycline|tetracycline|gentamicin|amikacin|septrin|bactrim|co-?trimoxazole|nitrofurantoin|clindamycin|vancomycin|benzylpenicillin|crystalline penicillin|benzathine|phenoxymethyl)\b/i },
  { cls: 'antimalarial', match: /\b(artemether|lumefantrine|alu|coartem|artefan|artesunate|dihydroartemisinin|piperaquine|quinine|proguanil|atovaquone|mefloquine)\b/i },
  { cls: 'antihistamine', match: /\b(cetirizine|loratadine|desloratadine|chlorpheniramine|piriton|promethazine|fexofenadine|levocetirizine)\b/i },
  { cls: 'analgesic', match: /\b(paracetamol|acetaminophen|pcm|panadol|calpol|ibuprofen|brufen|diclofenac|voltaren|voltarol|cataflam|mefenamic|naproxen|aspirin|tramadol|tramal|morphine|pethidine|codeine|celecoxib|piroxicam|indomethacin|pain\s?relief)\b/i },
  { cls: 'antidiabetic', match: /\b(metformin|glibenclamide|gliclazide|glimepiride|insulin|sitagliptin|empagliflozin|dapagliflozin)\b/i },
  { cls: 'antihypertensive', match: /\b(amlodipine|norvasc|nifedipine|adalat|losartan|telmisartan|valsartan|enalapril|lisinopril|captopril|atenolol|bisoprolol|carvedilol|hydrochlorothiazide|hctz|hct|methyldopa|hydralazine)\b/i },
  { cls: 'cardiovascular', match: /\b(atorvastatin|simvastatin|rosuvastatin|clopidogrel|warfarin|enoxaparin|digoxin|isosorbide|gtn|furosemide|frusemide|lasix|spironolactone)\b/i },
  { cls: 'respiratory', match: /\b(salbutamol|ventolin|beclomethasone|beclate|budesonide|ipratropium|montelukast|theophylline|ambroxol|aminophylline)\b/i },
  { cls: 'gastrointestinal', match: /\b(omeprazole|losek|esomeprazole|pantoprazole|lansoprazole|ranitidine|domperidone|motilium|metoclopramide|maxolon|hyoscine|buscopan|loperamide|ors|oral rehydration|lactulose|bisacodyl|albendazole|mebendazole|worm)\b/i },
  { cls: 'corticosteroid', match: /\b(prednisolone|prednisone|dexamethasone|dexona|hydrocortisone|betamethasone|methylprednisolone)\b/i },
  { cls: 'vitamin_supplement', match: /\b(vitamin|multivitamin|neurobion|ferrous|folic|folate|b12|cyanocobalamin|calcium|zinc|orsat|haematinic)\b/i },
  { cls: 'antiseptic', match: /\b(povidone|betadine|iodine|chlorhexidine|savlon|spirit|hydrogen peroxide|dettol|antiseptic)\b/i },
  { cls: 'infusion_fluid', match: /\b(normal saline|n\/s|\bns\b|hartmann|ringer|dextrose|dns|water for injection|wfi|iv fluid|infusion|giving set)\b/i },
  { cls: 'antifungal', match: /\b(fluconazole|clotrimazole|miconazole|ketoconazole|nystatin|terbinafine|griseofulvin)\b/i },
  { cls: 'antiviral', match: /\b(aciclovir|acyclovir|valaciclovir|oseltamivir|tenofovir|lamivudine|efavirenz|dolutegravir|arv)\b/i },
  { cls: 'contraceptive', match: /\b(levonorgestrel|microgynon|combined oral|iud|depo-?provera|implanon|contracept)\b/i },
  { cls: 'psychotropic', match: /\b(diazepam|lorazepam|clonazepam|amitriptyline|fluoxetine|sertraline|haloperidol|olanzapine|risperidone|carbamazepine|sodium valproate|phenytoin)\b/i },
  { cls: 'vaccine', match: /\b(vaccine|immuni[sz]ation|bcg|pentavalent|measles|hpv|tt |anti-?tetanus|rabies vaccine)\b/i },
  { cls: 'medical_consumable', match: /\b(glove|syringe|needle|gauze|cotton|cannula|catheter|foley|plaster|bandage|mask|spirit swab|rdt|pregnancy test|glucometer|strip|giving set|ng tube)\b/i },
];

export function classifyDrug(name: string, inventoryCategory?: string): DrugClass {
  if (inventoryCategory === 'medical_consumable') return 'medical_consumable';
  const text = name.trim();
  if (!text) return 'other';
  for (const rule of RULES) {
    if (rule.match.test(text)) return rule.cls;
  }
  return 'other';
}

export function drugClassLabel(value?: string | null): string {
  const labels: Record<DrugClass, string> = {
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
  };
  return labels[(value as DrugClass) ?? 'other'] ?? 'Other';
}
