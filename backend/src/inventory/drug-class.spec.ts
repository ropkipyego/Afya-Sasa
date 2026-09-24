import { classifyDrug } from './drug-class';

describe('classifyDrug', () => {
  it('classifies common hospital medicines', () => {
    expect(classifyDrug('Paracetamol 500mg tablet')).toBe('analgesic');
    expect(classifyDrug('Amoxicillin 500mg')).toBe('antibiotic');
    expect(classifyDrug('Cetirizine 10mg')).toBe('antihistamine');
    expect(classifyDrug('ALU 20/120')).toBe('antimalarial');
    expect(classifyDrug('Metformin 500mg')).toBe('antidiabetic');
    expect(classifyDrug('Amlodipine 5mg')).toBe('antihypertensive');
    expect(classifyDrug('Omeprazole 20mg')).toBe('gastrointestinal');
    expect(classifyDrug('Normal Saline 500ml')).toBe('infusion_fluid');
    expect(classifyDrug('PCM 500mg')).toBe('analgesic');
    expect(classifyDrug('Panadol extra')).toBe('analgesic');
    expect(classifyDrug('Flagyl 400mg')).toBe('antibiotic');
    expect(classifyDrug('Lasix 40mg')).toBe('cardiovascular');
  });

  it('uses the inventory category for consumables', () => {
    expect(classifyDrug('Examination gloves (medium)', 'medical_consumable')).toBe('medical_consumable');
  });
});
