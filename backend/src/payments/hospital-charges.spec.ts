import {
  accommodationChargeEntityId,
  accommodationOccupancyKey,
  billableAccommodationDates,
  buildOccupancySegments,
  chargeItemForWardType,
  classifyZeroPrice,
  defaultHospitalChargeCatalogue,
  isBillablePrice,
  planAccommodationCharges,
  previewCatalogueRows,
  resolveChargeUnitPrice,
} from './hospital-charges';

function atNairobi(iso: string) {
  return new Date(`${iso}+03:00`);
}

const generalBed = {
  id: 'bed-a',
  bedNo: '01',
  ward: { id: 'ward-a', name: 'Ward A', type: 'general' },
};

const icuBed = {
  id: 'bed-b',
  bedNo: '04',
  ward: { id: 'ward-b', name: 'ICU', type: 'icu' },
};

describe('hospital accommodation charging', () => {
  const policy = defaultHospitalChargeCatalogue().policy;

  it('excludes the discharge calendar day by default (25 Sep → 28 Sep = 3 days)', () => {
    expect(
      billableAccommodationDates({
        admittedAt: atNairobi('2026-09-25T10:00:00'),
        dischargedAt: atNairobi('2026-09-28T09:00:00'),
        policy,
      }),
    ).toEqual(['2026-09-25', '2026-09-26', '2026-09-27']);
  });

  it('can include every calendar day when the hospital chooses that policy', () => {
    expect(
      billableAccommodationDates({
        admittedAt: atNairobi('2026-09-25T10:00:00'),
        dischargedAt: atNairobi('2026-09-28T09:00:00'),
        policy: { ...policy, dayCount: 'calendar_inclusive' },
      }),
    ).toEqual(['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28']);
  });

  it('follows SHA-style overnight / nights-only: same-day stay earns no per-diem', () => {
    expect(
      billableAccommodationDates({
        admittedAt: atNairobi('2026-09-25T08:00:00'),
        dischargedAt: atNairobi('2026-09-25T18:00:00'),
        policy: { ...policy, dayCount: 'nights_only', sameDay: 'none' },
      }),
    ).toEqual([]);
  });

  it('charges a minimum one day for same-day cash stays when configured', () => {
    expect(
      billableAccommodationDates({
        admittedAt: atNairobi('2026-09-25T08:00:00'),
        dischargedAt: atNairobi('2026-09-25T18:00:00'),
        policy: { ...policy, sameDay: 'minimum_one' },
      }),
    ).toEqual(['2026-09-25']);
  });

  it('preserves transfer history instead of billing the final bed for every day', () => {
    const catalogue = defaultHospitalChargeCatalogue();
    const days = planAccommodationCharges({
      admissionId: 'adm-1',
      admittedAt: atNairobi('2026-09-25T10:00:00'),
      dischargedAt: atNairobi('2026-09-28T09:00:00'),
      currentBed: icuBed,
      transfers: [
        {
          createdAt: atNairobi('2026-09-27T14:00:00'),
          fromBed: generalBed,
          toBed: icuBed,
        },
      ],
      catalogue,
    });
    expect(days.map((day) => [day.serviceDate, day.wardType, day.chargeItemCode])).toEqual([
      ['2026-09-25', 'general', 'ACC-GENERAL'],
      ['2026-09-26', 'general', 'ACC-GENERAL'],
      ['2026-09-27', 'general', 'ACC-GENERAL'],
    ]);
  });

  it('uses the evening bed when the hospital anchors the day at end of day', () => {
    const catalogue = defaultHospitalChargeCatalogue();
    catalogue.policy.dayAnchor = 'end_of_day';
    const days = planAccommodationCharges({
      admissionId: 'adm-1',
      admittedAt: atNairobi('2026-09-25T10:00:00'),
      dischargedAt: atNairobi('2026-09-28T09:00:00'),
      currentBed: icuBed,
      transfers: [
        {
          createdAt: atNairobi('2026-09-27T14:00:00'),
          fromBed: generalBed,
          toBed: icuBed,
        },
      ],
      catalogue,
    });
    expect(days.find((day) => day.serviceDate === '2026-09-27')?.wardType).toBe('icu');
  });

  it('builds occupancy segments from the first bed through each transfer', () => {
    const segments = buildOccupancySegments({
      admittedAt: atNairobi('2026-09-25T10:00:00'),
      dischargedAt: atNairobi('2026-09-28T09:00:00'),
      currentBed: icuBed,
      transfers: [
        {
          createdAt: atNairobi('2026-09-27T14:00:00'),
          fromBed: generalBed,
          toBed: icuBed,
        },
      ],
    });
    expect(segments).toHaveLength(2);
    expect(segments[0].wardType).toBe('general');
    expect(segments[1].wardType).toBe('icu');
  });

  it('uses a stable occupancy key so a second run cannot invent a second charge', () => {
    const key = accommodationOccupancyKey({
      admissionId: 'adm-1',
      serviceDate: '2026-09-25',
      chargeItemCode: 'ACC-GENERAL',
      bedId: 'bed-a',
    });
    expect(key).toBe('acc:adm-1:2026-09-25:ACC-GENERAL:bed-a');
    expect(accommodationChargeEntityId(key)).toBe(accommodationChargeEntityId(key));
    expect(accommodationChargeEntityId(key)).not.toBe(
      accommodationChargeEntityId(accommodationOccupancyKey({
        admissionId: 'adm-1',
        serviceDate: '2026-09-26',
        chargeItemCode: 'ACC-GENERAL',
        bedId: 'bed-a',
      })),
    );
  });

  it('does not invent a rate when the hospital has not configured one', () => {
    const item = chargeItemForWardType(defaultHospitalChargeCatalogue().items, 'general');
    expect(item?.code).toBe('ACC-GENERAL');
    expect(resolveChargeUnitPrice(item!, '2026-09-25')).toBeNull();
  });

  it('keeps a posted historical price when a later catalogue rate is entered', () => {
    const item = {
      ...chargeItemForWardType(defaultHospitalChargeCatalogue().items, 'general')!,
      unitPrice: 3500,
      priceHistory: [{ from: '2026-01-01', unitPrice: 2500 }],
    };
    expect(resolveChargeUnitPrice(item, '2026-09-01')).toBe(2500);
  });

  it('maps ICU and HDU wards to their own charge items', () => {
    const items = defaultHospitalChargeCatalogue().items;
    expect(chargeItemForWardType(items, 'icu')?.code).toBe('ACC-ICU');
    expect(chargeItemForWardType(items, 'hdu')?.code).toBe('ACC-HDU');
  });
});

describe('billable catalogue preview', () => {
  it('never treats a zero or blank price as billable', () => {
    expect(isBillablePrice(0)).toBe(false);
    expect(isBillablePrice(null)).toBe(false);
    expect(isBillablePrice(3500)).toBe(true);
    expect(classifyZeroPrice({ unitPrice: 0, active: true, automatic: false })).toBe(
      'requires_hospital_price',
    );
  });

  it('matches exact codes and keeps similar names as review-only suggestions', () => {
    const existing = defaultHospitalChargeCatalogue().items;
    const preview = previewCatalogueRows(existing, [
      { code: 'ACC-GENERAL', name: 'General ward bed', unitPrice: 2500 },
      { name: 'General ward', unitPrice: 2500 },
      { name: 'Walk-in laboratory', unitPrice: 0 },
    ]);
    expect(preview[0].matchKind).toBe('exact_code');
    expect(preview[0].importable).toBe(true);
    expect(preview[1].matchKind).toBe('similar_name');
    expect(preview[1].importable).toBe(false);
    expect(preview[1].flags).toContain('near_duplicate');
    expect(preview[2].importable).toBe(false);
    expect(preview[2].flags).toContain('zero_price');
  });
});
