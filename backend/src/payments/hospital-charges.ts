import { createHash } from 'crypto';
import type { PaymentServiceLine } from './payment.entities';

/** Deterministic namespace so the same accommodation day always maps to the same charge UUID. */
export const ACCOMMODATION_CHARGE_NS = 'a1f0a5a5-5a5a-4c0e-9f0a-0000af5a5a01';

export const HOSPITAL_CHARGE_TIMEZONE = 'Africa/Nairobi';

export type ChargeDayCountPolicy =
  | 'calendar_inclusive'
  | 'calendar_exclude_discharge'
  | 'calendar_exclude_admission'
  | 'nights_only'
  | 'twenty_four_hour';

export type SameDayChargePolicy = 'none' | 'minimum_one' | 'follow_day_count';

export type ChargeDayAnchor = 'start_of_day' | 'end_of_day';

export type HospitalChargeCategory =
  | 'accommodation'
  | 'consultation'
  | 'nursing'
  | 'laboratory'
  | 'radiology'
  | 'pharmacy'
  | 'theatre'
  | 'maternity'
  | 'icu'
  | 'hdu'
  | 'procedure'
  | 'emergency'
  | 'dental'
  | 'orthopaedics'
  | 'physiotherapy'
  | 'endoscopy'
  | 'oncology'
  | 'oxygen'
  | 'ambulance'
  | 'consumable'
  | 'other';

export type BillingType =
  | 'fixed'
  | 'recurring'
  | 'quantity'
  | 'usage'
  | 'procedure'
  | 'inventory'
  | 'package';

export type ChargeTrigger =
  | 'encounter'
  | 'lab_result'
  | 'radiology_complete'
  | 'pharmacy_dispense'
  | 'occupancy'
  | 'theatre_complete'
  | 'documented_usage'
  | 'manual';

export type ZeroPriceClass =
  | 'priced'
  | 'non_billable'
  | 'workflow_derived'
  | 'inactive'
  | 'requires_hospital_price';

export type PayerScheme = 'cash' | 'sha' | 'insurance' | 'corporate' | 'staff' | 'waiver';

const PAYER_SCHEMES: readonly PayerScheme[] = ['cash', 'sha', 'insurance', 'corporate', 'staff', 'waiver'];

export function asPayerScheme(value?: string | null): PayerScheme | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && PAYER_SCHEMES.includes(normalized as PayerScheme)
    ? (normalized as PayerScheme)
    : null;
}

export type HospitalChargeItem = {
  code: string;
  name: string;
  description?: string | null;
  department?: string | null;
  category: HospitalChargeCategory;
  chargeType: 'accommodation' | 'service' | 'manual';
  billingType?: BillingType;
  chargeTrigger?: ChargeTrigger;
  calculationMethod?: string | null;
  unit: string;
  /** Current cash/self-pay rate. Null until the hospital configures it. Never invent. */
  unitPrice: number | null;
  active: boolean;
  automatic: boolean;
  recurrence: 'none' | 'daily';
  effectiveFrom?: string | null;
  payerPrices?: Partial<Record<PayerScheme, number>>;
  priceHistory?: Array<{ from: string; unitPrice: number }>;
  wardTypes?: string[];
  zeroPriceClass?: ZeroPriceClass;
  source?: 'quickbooks' | 'hospital' | 'system';
  sourceName?: string | null;
  sourceItemCode?: string | null;
  /** QuickBooks account mapping only. Never copied onto a patient charge amount. */
  accounting?: {
    account?: string | null;
    cogsAccount?: string | null;
    assetAccount?: string | null;
    vat?: string | null;
    supplier?: string | null;
  };
  calculationApproved?: boolean;
};

export type HospitalChargePolicy = {
  dayCount: ChargeDayCountPolicy;
  sameDay: SameDayChargePolicy;
  dayAnchor: ChargeDayAnchor;
  timeZone: string;
  blockDischargeOnBalance: boolean;
};

export type HospitalChargeJobStatus = {
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastGenerated: number;
  lastSkipped: number;
  lastErrors: string[];
  lastAdmissions: number;
  lastMessage: string | null;
};

export type HospitalChargeCatalogue = {
  policy: HospitalChargePolicy;
  items: HospitalChargeItem[];
  job: HospitalChargeJobStatus;
  oxygen?: {
    formulaApproved: boolean;
    method: 'litres' | 'flow_x_duration' | null;
    note: string;
  };
};

export type OccupancySegment = {
  from: Date;
  to: Date;
  bedId: string;
  bedNo: string;
  wardId: string;
  wardName: string;
  wardType: string;
};

export type BillableAccommodationDay = {
  serviceDate: string;
  bedId: string;
  bedNo: string;
  wardId: string;
  wardName: string;
  wardType: string;
  chargeItemCode: string;
  occupancyKey: string;
};

export const DEFAULT_HOSPITAL_CHARGE_POLICY: HospitalChargePolicy = {
  dayCount: 'calendar_exclude_discharge',
  sameDay: 'minimum_one',
  dayAnchor: 'start_of_day',
  timeZone: HOSPITAL_CHARGE_TIMEZONE,
  blockDischargeOnBalance: false,
};

export const DEFAULT_ACCOMMODATION_ITEMS: HospitalChargeItem[] = [
  {
    code: 'ACC-GENERAL',
    name: 'General ward accommodation',
    category: 'accommodation',
    chargeType: 'accommodation',
    unit: 'day',
    unitPrice: null,
    active: true,
    automatic: true,
    recurrence: 'daily',
    wardTypes: ['general'],
  },
  {
    code: 'ACC-MEDICAL',
    name: 'Medical ward accommodation',
    category: 'accommodation',
    chargeType: 'accommodation',
    unit: 'day',
    unitPrice: null,
    active: true,
    automatic: true,
    recurrence: 'daily',
    wardTypes: ['medical'],
  },
  {
    code: 'ACC-SURGICAL',
    name: 'Surgical ward accommodation',
    category: 'accommodation',
    chargeType: 'accommodation',
    unit: 'day',
    unitPrice: null,
    active: true,
    automatic: true,
    recurrence: 'daily',
    wardTypes: ['surgical'],
  },
  {
    code: 'ACC-PRIVATE',
    name: 'Private ward accommodation',
    category: 'accommodation',
    chargeType: 'accommodation',
    unit: 'day',
    unitPrice: null,
    active: true,
    automatic: true,
    recurrence: 'daily',
    wardTypes: [],
  },
  {
    code: 'ACC-SEMI-PRIVATE',
    name: 'Semi-private ward accommodation',
    category: 'accommodation',
    chargeType: 'accommodation',
    unit: 'day',
    unitPrice: null,
    active: true,
    automatic: true,
    recurrence: 'daily',
    wardTypes: [],
  },
  {
    code: 'ACC-ICU',
    name: 'ICU accommodation',
    category: 'icu',
    chargeType: 'accommodation',
    unit: 'day',
    unitPrice: null,
    active: true,
    automatic: true,
    recurrence: 'daily',
    wardTypes: ['icu'],
  },
  {
    code: 'ACC-HDU',
    name: 'HDU accommodation',
    category: 'hdu',
    chargeType: 'accommodation',
    unit: 'day',
    unitPrice: null,
    active: true,
    automatic: true,
    recurrence: 'daily',
    wardTypes: ['hdu'],
  },
  {
    code: 'ACC-MATERNITY',
    name: 'Maternity accommodation',
    category: 'maternity',
    chargeType: 'accommodation',
    unit: 'day',
    unitPrice: null,
    active: true,
    automatic: true,
    recurrence: 'daily',
    wardTypes: ['maternity'],
  },
  {
    code: 'ACC-PAEDIATRIC',
    name: 'Paediatric accommodation',
    category: 'accommodation',
    chargeType: 'accommodation',
    unit: 'day',
    unitPrice: null,
    active: true,
    automatic: true,
    recurrence: 'daily',
    wardTypes: ['paediatric'],
  },
  {
    code: 'ACC-ISOLATION',
    name: 'Isolation accommodation',
    category: 'accommodation',
    chargeType: 'accommodation',
    unit: 'day',
    unitPrice: null,
    active: true,
    automatic: true,
    recurrence: 'daily',
    wardTypes: ['isolation'],
  },
];

const WARD_TYPE_TO_CODE: Record<string, string> = {
  general: 'ACC-GENERAL',
  medical: 'ACC-MEDICAL',
  surgical: 'ACC-SURGICAL',
  icu: 'ACC-ICU',
  hdu: 'ACC-HDU',
  maternity: 'ACC-MATERNITY',
  paediatric: 'ACC-PAEDIATRIC',
  isolation: 'ACC-ISOLATION',
};

export function emptyJobStatus(): HospitalChargeJobStatus {
  return {
    lastRunAt: null,
    lastSuccessAt: null,
    lastGenerated: 0,
    lastSkipped: 0,
    lastErrors: [],
    lastAdmissions: 0,
    lastMessage: null,
  };
}

export function defaultHospitalChargeCatalogue(): HospitalChargeCatalogue {
  return {
    policy: { ...DEFAULT_HOSPITAL_CHARGE_POLICY },
    items: [...DEFAULT_ACCOMMODATION_ITEMS, ...SYSTEM_SERVICE_TEMPLATES].map((item) => ({ ...item })),
    job: emptyJobStatus(),
    oxygen: { ...DEFAULT_OXYGEN_POLICY },
  };
}

export function readHospitalChargeCatalogue(catalog: Record<string, unknown> | null | undefined): HospitalChargeCatalogue {
  const raw = (catalog?.hospitalCharges ?? {}) as Partial<HospitalChargeCatalogue>;
  const defaults = defaultHospitalChargeCatalogue();
  const items = mergeCatalogueItems(defaults.items, Array.isArray(raw.items) ? raw.items : []);
  return {
    policy: {
      ...defaults.policy,
      ...(raw.policy ?? {}),
      timeZone: raw.policy?.timeZone || HOSPITAL_CHARGE_TIMEZONE,
    },
    items,
    job: { ...defaults.job, ...(raw.job ?? {}) },
    oxygen: { ...defaults.oxygen!, ...(raw.oxygen ?? {}) },
  };
}

function mergeCatalogueItems(defaults: HospitalChargeItem[], stored: HospitalChargeItem[]): HospitalChargeItem[] {
  const byCode = new Map<string, HospitalChargeItem>();
  for (const item of defaults) byCode.set(item.code, { ...item });
  for (const item of stored) {
    if (!item?.code) continue;
    const current = byCode.get(item.code);
    byCode.set(item.code, current ? { ...current, ...item, code: item.code } : normalizeStoredItem(item));
  }
  return [...byCode.values()];
}

function normalizeStoredItem(item: HospitalChargeItem): HospitalChargeItem {
  return {
    code: String(item.code).trim().toUpperCase(),
    name: item.name || item.code,
    category: item.category || 'other',
    chargeType: item.chargeType || 'service',
    unit: item.unit || 'each',
    unitPrice: Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : null,
    active: item.active !== false,
    automatic: Boolean(item.automatic),
    recurrence: item.recurrence === 'daily' ? 'daily' : 'none',
    description: item.description ?? null,
    department: item.department ?? inferDepartment(item.category),
    billingType: item.billingType ?? inferBillingType(item),
    chargeTrigger: item.chargeTrigger ?? inferChargeTrigger(item),
    calculationMethod: item.calculationMethod ?? null,
    effectiveFrom: item.effectiveFrom ?? null,
    payerPrices: item.payerPrices,
    priceHistory: item.priceHistory,
    wardTypes: item.wardTypes,
    zeroPriceClass: classifyZeroPrice(item),
    source: item.source ?? 'hospital',
    sourceName: item.sourceName ?? item.name,
    sourceItemCode: item.sourceItemCode ?? null,
    accounting: item.accounting,
    calculationApproved: item.calculationApproved === true,
  };
}

export function inferDepartment(category: HospitalChargeCategory): string {
  const map: Record<HospitalChargeCategory, string> = {
    accommodation: 'IPD',
    consultation: 'OPD',
    nursing: 'Nursing',
    laboratory: 'Laboratory',
    radiology: 'Radiology',
    pharmacy: 'Pharmacy',
    theatre: 'Theatre',
    maternity: 'Maternity',
    icu: 'ICU',
    hdu: 'HDU',
    procedure: 'Theatre',
    emergency: 'Emergency',
    dental: 'Dental',
    orthopaedics: 'Orthopaedics',
    physiotherapy: 'Physiotherapy',
    endoscopy: 'Endoscopy',
    oncology: 'Oncology',
    oxygen: 'Respiratory',
    ambulance: 'Ambulance',
    consumable: 'Consumables',
    other: 'Other',
  };
  return map[category] ?? 'Other';
}

export function inferBillingType(item: Pick<HospitalChargeItem, 'chargeType' | 'category' | 'recurrence'>): BillingType {
  if (item.recurrence === 'daily' || item.chargeType === 'accommodation') return 'recurring';
  if (item.category === 'pharmacy' || item.category === 'consumable') return 'inventory';
  if (item.category === 'oxygen') return 'usage';
  if (item.category === 'theatre' || item.category === 'procedure' || item.category === 'endoscopy') return 'procedure';
  if (item.category === 'laboratory' || item.category === 'radiology' || item.category === 'consultation') return 'fixed';
  return 'fixed';
}

export function inferChargeTrigger(item: Pick<HospitalChargeItem, 'category' | 'chargeType'>): ChargeTrigger {
  if (item.chargeType === 'accommodation' || item.category === 'icu' || item.category === 'hdu') return 'occupancy';
  if (item.category === 'laboratory') return 'lab_result';
  if (item.category === 'radiology') return 'radiology_complete';
  if (item.category === 'pharmacy') return 'pharmacy_dispense';
  if (item.category === 'theatre' || item.category === 'procedure') return 'theatre_complete';
  if (item.category === 'oxygen') return 'documented_usage';
  if (item.category === 'consultation' || item.category === 'emergency') return 'encounter';
  return 'manual';
}

export function classifyZeroPrice(item: Pick<HospitalChargeItem, 'unitPrice' | 'active' | 'zeroPriceClass' | 'automatic'>): ZeroPriceClass {
  if (item.zeroPriceClass) return item.zeroPriceClass;
  if (item.active === false) return 'inactive';
  if (item.unitPrice != null && item.unitPrice > 0) return 'priced';
  return 'requires_hospital_price';
}

export function isBillablePrice(price: number | null | undefined): price is number {
  return Number.isFinite(Number(price)) && Number(price) > 0;
}

export function normalizeServiceIdentity(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(fee|charge|charges|service|services|the|of|and|for)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type CatalogueImportRow = {
  code?: string;
  name?: string;
  sourceItemCode?: string;
  sourceName?: string;
  department?: string;
  category?: string;
  unit?: string;
  unitPrice?: number | null;
  account?: string;
  cogsAccount?: string;
  assetAccount?: string;
  vat?: string;
  supplier?: string;
};

export type CatalogueMatchKind = 'exact_code' | 'source_code' | 'normalized_name' | 'similar_name' | 'new';

export type CataloguePreviewRow = {
  row: CatalogueImportRow;
  matchKind: CatalogueMatchKind;
  matchedCode?: string;
  flags: string[];
  importable: boolean;
};

export function previewCatalogueRows(existing: HospitalChargeItem[], rows: CatalogueImportRow[]): CataloguePreviewRow[] {
  const byCode = new Map(existing.map((item) => [item.code.toUpperCase(), item]));
  const bySource = new Map(
    existing.filter((item) => item.sourceItemCode).map((item) => [String(item.sourceItemCode).toUpperCase(), item]),
  );
  const byIdentity = new Map(existing.map((item) => [normalizeServiceIdentity(item.sourceName || item.name), item]));

  return rows.map((row) => {
    const code = (row.code || row.sourceItemCode || '').trim().toUpperCase();
    const name = (row.name || row.sourceName || '').trim();
    const identity = normalizeServiceIdentity(name);
    const exact = code && byCode.get(code);
    const source = code && bySource.get(code);
    const normalized = identity ? byIdentity.get(identity) : undefined;
    const similar =
      !exact && !source && !normalized && identity
        ? existing.find((item) => {
            const other = normalizeServiceIdentity(item.sourceName || item.name);
            return other.includes(identity) || identity.includes(other);
          })
        : undefined;
    const matched = exact || source || normalized;
    const matchKind: CatalogueMatchKind = exact
      ? 'exact_code'
      : source
        ? 'source_code'
        : normalized
          ? 'normalized_name'
          : similar
            ? 'similar_name'
            : 'new';
    const price = row.unitPrice == null ? null : Number(row.unitPrice);
    const flags: string[] = [];
    if (!name) flags.push('missing_name');
    if (price === 0) flags.push('zero_price');
    if (price != null && price < 0) flags.push('invalid_price');
    if (price == null) flags.push('missing_price');
    if (similar && matchKind === 'similar_name') flags.push('near_duplicate');
    if (matched && isBillablePrice(matched.unitPrice) && isBillablePrice(price) && matched.unitPrice !== price) {
      flags.push('conflicting_price');
    }
    if (matched && row.unit && matched.unit && matched.unit !== row.unit) flags.push('conflicting_unit');
    if (!row.department && !row.category) flags.push('ambiguous_department');
    const importable =
      Boolean(name) &&
      isBillablePrice(price) &&
      matchKind !== 'similar_name' &&
      !flags.includes('invalid_price');
    return {
      row: { ...row, code: code || undefined, name, unitPrice: price },
      matchKind,
      matchedCode: matched?.code ?? similar?.code,
      flags,
      importable,
    };
  });
}

export function paginateCatalogueItems(
  items: HospitalChargeItem[],
  query: { q?: string; department?: string; review?: string; page?: number; pageSize?: number },
) {
  const q = query.q?.trim().toLowerCase() ?? '';
  const filtered = items.filter((item) => {
    if (query.department && (item.department ?? inferDepartment(item.category)) !== query.department) return false;
    if (query.review === 'unpriced' && classifyZeroPrice(item) === 'requires_hospital_price') return true;
    if (query.review === 'unpriced') return false;
    if (query.review === 'zero' && item.unitPrice === 0) return true;
    if (query.review === 'zero') return false;
    if (!q) return true;
    return [item.code, item.name, item.sourceName, item.sourceItemCode, item.department]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  });
  const pageSize = Math.min(Math.max(query.pageSize ?? 25, 1), 100);
  const page = Math.max(query.page ?? 1, 1);
  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
    departments: [...new Set(items.map((item) => item.department ?? inferDepartment(item.category)))].sort(),
  };
}

export const QUICKBOOKS_MAPPING_RULES = [
  'QuickBooks Item → AfyaSasa billable service. Patient charges never copy COGS, Asset, VAT, Supplier, Qty on Hand, or Reorder Point.',
  'QuickBooks Price / Gross Price → hospital cash tariff only when the amount is greater than zero.',
  'QuickBooks U/M → billing unit when present. A blank U/M is allowed for fixed services (quantity 1).',
  'QuickBooks Account → accounting mapping reference for a future export. It is not a patient charge field.',
  'Zero-priced QuickBooks rows stay unpriced / non-billable until the hospital classifies them.',
  'jalaram_hospital_charge_mapping.xlsx is the controlled mapping source. Do not auto-import it.',
];

export const DEFAULT_OXYGEN_POLICY = {
  formulaApproved: false,
  method: null as 'litres' | 'flow_x_duration' | null,
  note: 'OXYGEN THERAPY appears in the QuickBooks master at KSh 5 per litre. Do not auto-charge until the hospital approves whether billable quantity is litres, flow × duration, or another measured value.',
};

export const SYSTEM_SERVICE_TEMPLATES: HospitalChargeItem[] = [
  {
    code: 'OXYGEN-THERAPY',
    name: 'Oxygen therapy',
    description: 'Usage-based. Formula not approved.',
    department: 'Respiratory',
    category: 'oxygen',
    chargeType: 'service',
    billingType: 'usage',
    chargeTrigger: 'documented_usage',
    calculationMethod: null,
    unit: 'litre',
    unitPrice: null,
    active: true,
    automatic: false,
    recurrence: 'none',
    zeroPriceClass: 'requires_hospital_price',
    source: 'quickbooks',
    sourceName: 'OXYGEN THERAPY',
    calculationApproved: false,
  },
  {
    code: 'OXYGEN-CHARGE',
    name: 'Oxygen charge',
    department: 'Respiratory',
    category: 'oxygen',
    chargeType: 'service',
    billingType: 'usage',
    chargeTrigger: 'documented_usage',
    unit: 'each',
    unitPrice: null,
    active: true,
    automatic: false,
    recurrence: 'none',
    zeroPriceClass: 'requires_hospital_price',
    source: 'quickbooks',
    sourceName: 'OXYGEN CHARGE',
    calculationApproved: false,
  },
  {
    code: 'OXYGEN-CONCENTRATOR',
    name: 'Oxygen concentrator',
    department: 'Respiratory',
    category: 'oxygen',
    chargeType: 'service',
    billingType: 'usage',
    chargeTrigger: 'documented_usage',
    unit: 'each',
    unitPrice: null,
    active: true,
    automatic: false,
    recurrence: 'none',
    zeroPriceClass: 'requires_hospital_price',
    source: 'quickbooks',
    sourceName: 'OXYGEN CONCENTRATOR',
    calculationApproved: false,
  },
];

export function formatDateInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

export function zonedDateTime(isoDate: string, timeZone: string, hour = 0, minute = 0, second = 0): Date {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7)) - 1;
  const day = Number(isoDate.slice(8, 10));
  const utcGuess = new Date(Date.UTC(year, month, day, hour, minute, second));
  return new Date(utcGuess.getTime() - tzOffsetMs(utcGuess, timeZone));
}

export function addCalendarDays(isoDate: string, days: number): string {
  const utc = new Date(`${isoDate}T00:00:00.000Z`);
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function eachCalendarDate(from: string, to: string): string[] {
  if (from > to) return [];
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return dates;
}

export function chargeItemForWardType(items: HospitalChargeItem[], wardType: string): HospitalChargeItem | null {
  const typed = items.find(
    (item) =>
      item.active &&
      item.chargeType === 'accommodation' &&
      (item.wardTypes ?? []).includes(wardType),
  );
  if (typed) return typed;
  const fallbackCode = WARD_TYPE_TO_CODE[wardType] ?? 'ACC-GENERAL';
  return items.find((item) => item.code === fallbackCode) ?? items.find((item) => item.code === 'ACC-GENERAL') ?? null;
}

export function resolveChargeUnitPrice(
  item: HospitalChargeItem,
  serviceDate: string,
  payerScheme?: string | null,
): number | null {
  const payer = asPayerScheme(payerScheme);
  if (payer && item.payerPrices?.[payer] != null) {
    const payerPrice = Number(item.payerPrices[payer]);
    if (Number.isFinite(payerPrice) && payerPrice > 0) return payerPrice;
  }
  const history = [...(item.priceHistory ?? [])]
    .filter((row) => row.from && row.from <= serviceDate && Number(row.unitPrice) > 0)
    .sort((a, b) => a.from.localeCompare(b.from));
  if (history.length) return Number(history[history.length - 1].unitPrice);
  if (item.effectiveFrom && item.effectiveFrom > serviceDate) return null;
  const current = Number(item.unitPrice);
  return isBillablePrice(current) ? current : null;
}

export function accommodationOccupancyKey(params: {
  admissionId: string;
  serviceDate: string;
  chargeItemCode: string;
  bedId: string;
}): string {
  return `acc:${params.admissionId}:${params.serviceDate}:${params.chargeItemCode}:${params.bedId}`;
}

export function accommodationChargeEntityId(occupancyKey: string): string {
  const ns = ACCOMMODATION_CHARGE_NS.replace(/-/g, '');
  const hash = createHash('sha1')
    .update(Buffer.from(ns, 'hex'))
    .update(occupancyKey)
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function buildOccupancySegments(params: {
  admittedAt: Date;
  dischargedAt: Date | null;
  currentBed: { id: string; bedNo: string; ward: { id: string; name: string; type: string } };
  transfers: Array<{
    createdAt: Date;
    fromBed: { id: string; bedNo: string; ward: { id: string; name: string; type: string } };
    toBed: { id: string; bedNo: string; ward: { id: string; name: string; type: string } };
  }>;
  now?: Date;
}): OccupancySegment[] {
  const end = params.dischargedAt ?? params.now ?? new Date();
  const ordered = [...params.transfers].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  if (!ordered.length) {
    return [
      {
        from: params.admittedAt,
        to: end,
        bedId: params.currentBed.id,
        bedNo: params.currentBed.bedNo,
        wardId: params.currentBed.ward.id,
        wardName: params.currentBed.ward.name,
        wardType: params.currentBed.ward.type,
      },
    ];
  }

  const segments: OccupancySegment[] = [];
  let cursor = params.admittedAt;
  let bed = ordered[0].fromBed;
  for (const transfer of ordered) {
    const at = transfer.createdAt;
    if (at > cursor) {
      segments.push(segmentFromBed(cursor, at < end ? at : end, bed));
    }
    cursor = at > cursor ? at : cursor;
    bed = transfer.toBed;
    if (cursor >= end) break;
  }
  if (cursor < end) {
    segments.push(segmentFromBed(cursor, end, params.currentBed));
  }
  return segments.filter((segment) => segment.to > segment.from);
}

function segmentFromBed(
  from: Date,
  to: Date,
  bed: { id: string; bedNo: string; ward: { id: string; name: string; type: string } },
): OccupancySegment {
  return {
    from,
    to,
    bedId: bed.id,
    bedNo: bed.bedNo,
    wardId: bed.ward.id,
    wardName: bed.ward.name,
    wardType: bed.ward.type,
  };
}

export function segmentAtInstant(segments: OccupancySegment[], instant: Date): OccupancySegment | null {
  const hit = segments.find((segment) => instant >= segment.from && instant < segment.to);
  if (hit) return hit;
  return segments.find((segment) => instant >= segment.from && instant <= segment.to) ?? segments.at(-1) ?? null;
}

export function billableAccommodationDates(params: {
  admittedAt: Date;
  dischargedAt: Date | null;
  policy: HospitalChargePolicy;
  now?: Date;
}): string[] {
  const timeZone = params.policy.timeZone || HOSPITAL_CHARGE_TIMEZONE;
  const end = params.dischargedAt ?? params.now ?? new Date();
  const admitDate = formatDateInZone(params.admittedAt, timeZone);
  const endDate = formatDateInZone(end, timeZone);
  const sameDay = admitDate === endDate;

  if (sameDay) {
    if (params.policy.sameDay === 'none') return [];
    if (params.policy.sameDay === 'minimum_one') return [admitDate];
  }

  if (params.policy.dayCount === 'nights_only') {
    if (sameDay) return [];
    const lastNight = addCalendarDays(endDate, -1);
    return eachCalendarDate(admitDate, lastNight);
  }

  if (params.policy.dayCount === 'twenty_four_hour') {
    const elapsed = Math.max(0, end.getTime() - params.admittedAt.getTime());
    const periods = Math.floor(elapsed / 86_400_000);
    const dates: string[] = [];
    for (let i = 0; i < periods; i += 1) {
      dates.push(formatDateInZone(new Date(params.admittedAt.getTime() + i * 86_400_000), timeZone));
    }
    if (!dates.length && params.policy.sameDay === 'minimum_one') return [admitDate];
    return dates;
  }

  let from = admitDate;
  let to = endDate;
  if (params.policy.dayCount === 'calendar_exclude_discharge' && !sameDay) {
    to = addCalendarDays(endDate, -1);
  }
  if (params.policy.dayCount === 'calendar_exclude_admission' && !sameDay) {
    from = addCalendarDays(admitDate, 1);
  }
  const dates = eachCalendarDate(from, to);
  if (!dates.length && params.policy.sameDay === 'minimum_one') return [admitDate];
  return dates;
}

export type BedOccupancyRef = {
  id: string;
  bedNo: string;
  ward: { id: string; name: string; type: string };
};

export function planAccommodationCharges(params: {
  admissionId: string;
  admittedAt: Date;
  dischargedAt: Date | null;
  currentBed: BedOccupancyRef;
  transfers: Array<{
    createdAt: Date;
    fromBed: BedOccupancyRef;
    toBed: BedOccupancyRef;
  }>;
  catalogue: HospitalChargeCatalogue;
  now?: Date;
}): BillableAccommodationDay[] {
  const policy = params.catalogue.policy;
  const dates = billableAccommodationDates({
    admittedAt: params.admittedAt,
    dischargedAt: params.dischargedAt,
    policy,
    now: params.now,
  });
  const segments = buildOccupancySegments({
    admittedAt: params.admittedAt,
    dischargedAt: params.dischargedAt,
    currentBed: params.currentBed,
    transfers: params.transfers,
    now: params.now,
  });

  const occupancyEnd = params.dischargedAt ?? params.now ?? new Date();
  return dates.flatMap((serviceDate) => {
    const dayStart = zonedDateTime(serviceDate, policy.timeZone, 0, 0, 0);
    const dayEnd = zonedDateTime(serviceDate, policy.timeZone, 23, 59, 59);
    const rawInstant = policy.dayAnchor === 'end_of_day' ? dayEnd : dayStart;
    const instant = new Date(
      Math.min(
        Math.max(rawInstant.getTime(), params.admittedAt.getTime()),
        occupancyEnd.getTime(),
      ),
    );
    const segment = segmentAtInstant(segments, instant);
    if (!segment) return [];
    const item = chargeItemForWardType(params.catalogue.items, segment.wardType);
    if (!item?.automatic || !item.active) return [];
    const occupancyKey = accommodationOccupancyKey({
      admissionId: params.admissionId,
      serviceDate,
      chargeItemCode: item.code,
      bedId: segment.bedId,
    });
    return [
      {
        serviceDate,
        bedId: segment.bedId,
        bedNo: segment.bedNo,
        wardId: segment.wardId,
        wardName: segment.wardName,
        wardType: segment.wardType,
        chargeItemCode: item.code,
        occupancyKey,
      },
    ];
  });
}

export function serviceLineForCategory(category: HospitalChargeCategory): PaymentServiceLine {
  if (category === 'laboratory') return 'laboratory';
  if (category === 'radiology') return 'radiology';
  if (category === 'pharmacy') return 'pharmacy';
  if (category === 'consultation' || category === 'emergency') return 'consultation';
  if (category === 'theatre' || category === 'procedure') return 'other';
  if (
    category === 'accommodation' ||
    category === 'icu' ||
    category === 'hdu' ||
    category === 'nursing' ||
    category === 'maternity'
  ) {
    return 'inpatient';
  }
  return 'other';
}

export function chargeSourceLabel(metadata: Record<string, unknown> | null | undefined, serviceLine: string): string {
  const source = typeof metadata?.source === 'string' ? metadata.source : null;
  if (source) return source;
  const kind = typeof metadata?.kind === 'string' ? metadata.kind : null;
  if (kind === 'accommodation') return 'ACCOMMODATION';
  if (kind === 'manual') return 'MANUAL';
  if (kind === 'pharmacy_dispense') return 'PHARMACY';
  if (serviceLine === 'laboratory') return 'LABORATORY';
  if (serviceLine === 'radiology') return 'RADIOLOGY';
  if (serviceLine === 'pharmacy') return 'PHARMACY';
  if (serviceLine === 'inpatient') return 'ACCOMMODATION';
  if (serviceLine === 'consultation') return 'CONSULTATION';
  return serviceLine.toUpperCase();
}
