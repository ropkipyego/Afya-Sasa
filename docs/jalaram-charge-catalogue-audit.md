# Jalaram Hospital — Charge catalogue audit

**Date:** 26 September 2026  
**Instance:** Live Jalaram AfyaSasa  
**Database writes in this pass:** none (settings JSON, patients, charges, and payments were not rewritten)

---

## A. Current database state

**Authoritative catalogue path**

| | |
|---|---|
| Tenant | `jalaram` / Jalaram Hospital |
| Settings table | `public.settings` |
| Catalogue path | `clinical_catalog.hospitalCharges` |
| Competing price stores (also in `clinical_catalog`) | `labTestPricing`, `structuredClinics.consultationFee` |
| Competing clinic fees table | `demo.clinics.consultation_fee` |
| Inventory sell map | `clinical_catalog.inventoryPricing` — **absent** |
| Radiology study tariffs | `clinical_catalog.radiologyStudies` — **absent** |
| Second charges/payments table | **None** |

`hospitalCharges` is the declared hospital-wide tariff object. It currently holds **system templates only**. It does **not** contain a 261-row QuickBooks import.

| Metric | Count |
|---|---|
| Catalogue entries (`hospitalCharges.items`) | **13** |
| Priced (`unitPrice` > 0) | **0** |
| Zero price (`unitPrice` = 0) | **0** |
| Missing price (`null`) | **13** |
| Active | **13** |
| Inactive | **0** |
| Duplicate codes | **0** |
| Potential duplicate names | **0** |
| Automatic | 10 (all accommodation) |
| Manual | 3 (oxygen) |
| Effective dates | none |
| Review class | 3 `requires_hospital_price` (oxygen); 10 unset |

**All 13 items**

| Code | Name | Category | Price | Auto |
|---|---|---|---|---|
| ACC-GENERAL | General ward accommodation | accommodation | Unpriced | Yes |
| ACC-MEDICAL | Medical ward accommodation | accommodation | Unpriced | Yes |
| ACC-SURGICAL | Surgical ward accommodation | accommodation | Unpriced | Yes |
| ACC-PRIVATE | Private ward accommodation | accommodation | Unpriced | Yes |
| ACC-SEMI-PRIVATE | Semi-private ward accommodation | accommodation | Unpriced | Yes |
| ACC-ICU | ICU accommodation | icu | Unpriced | Yes |
| ACC-HDU | HDU accommodation | hdu | Unpriced | Yes |
| ACC-MATERNITY | Maternity accommodation | maternity | Unpriced | Yes |
| ACC-PAEDIATRIC | Paediatric accommodation | accommodation | Unpriced | Yes |
| ACC-ISOLATION | Isolation accommodation | accommodation | Unpriced | Yes |
| OXYGEN-THERAPY | Oxygen therapy | oxygen | Unpriced | No |
| OXYGEN-CHARGE | Oxygen charge | oxygen | Unpriced | No |
| OXYGEN-CONCENTRATOR | Oxygen concentrator | oxygen | Unpriced | No |

Oxygen formula: **not approved** (`formulaApproved: false`).

**Day policy (unchanged):** calendar days, exclude discharge day; same-day minimum one; start-of-day bed owns transfer day.

**Operational ledger**

| Table | Count | Notes |
|---|---|---|
| `demo.charges` | **0** | Nothing posted. Historical charges are not at risk. |
| `demo.payment_transactions` | **2** | General OPD consultation KSh 1,000; Phase 1 UAT consultation KSh 500. Neither rewritten. |

---

## B. Department mapping

Imported hospital money that **does** exist lives in other stores, not in `hospitalCharges`.

### OPD / Consultation — MATCHED (clinic fee store)

| Clinic | Tariff | Status |
|---|---|---|
| General OPD | 1,000 | MATCHED to `demo.clinics` + cashier |
| General Physician | 2,000 | MATCHED |
| ENT | 2,000 | MATCHED |
| Gynaecology | 2,500 | MATCHED |
| Orthopaedic | 2,000 | MATCHED |
| Maternity Clinic | 1,500 | MATCHED |
| Paediatrics Clinic | 1,500 | MATCHED |
| Physiotherapy | 1,000 | MATCHED (clinic fee; no physiotherapy procedure catalogue) |
| Cardiology | 2,500 | REQUIRES_REVIEW — clinic inactive |
| Dermatology | 2,000 | REQUIRES_REVIEW — clinic inactive |

No hospitalCharges rows for consultation / specialist / follow-up / walk-in. OPD prices are **not** hardcoded in source; they are stored on `demo.clinics`.

### Emergency — MISSING_IN_WORKFLOW / WORKFLOW_EXISTS_BUT_NO_TARIFF

ED workflow exists. No emergency consultation or procedure tariff in `hospitalCharges`.

### IPD / Accommodation — WORKFLOW_EXISTS_BUT_NO_TARIFF

Engine: admission + transfer history + catalogue item. All ACC-* unpriced → UNPRICED, no charge posted.

| Ward | Ward type | Catalogue code | Tariff |
|---|---|---|---|
| General Ward — Male/Female | general | ACC-GENERAL | Unpriced |
| Surgical Private Suites | surgical | ACC-SURGICAL | Unpriced |
| Paediatrics | paediatric | ACC-PAEDIATRIC | Unpriced |
| Maternity / Labour / Postnatal / ANC / NICU / Nursery | maternity | ACC-MATERNITY | Unpriced |
| High Dependency Unit | hdu | ACC-HDU | Unpriced |
| *(no ICU ward)* | icu | ACC-ICU | Unpriced — no matching ward |
| Test Ward | general | ACC-GENERAL | Leftover test ward — REQUIRES_REVIEW |
| ACC-PRIVATE / SEMI-PRIVATE / MEDICAL / ISOLATION | — | those codes | No matching ward |

### Laboratory — MATCHED to `labTestPricing` (not hospitalCharges)

| | |
|---|---|
| Orderable tests | 192 |
| Priced in `labTestPricing` | **55** — all 55 codes exist on an orderable test |
| Orderable with no tariff | **137** — WORKFLOW_EXISTS_BUT_NO_TARIFF |
| hospitalCharges laboratory items | **0** |
| Charge trigger today | **On request create**, if sum of sell prices > 0 |
| Desired trigger | Verification → charge |

### Radiology — WORKFLOW_EXISTS_BUT_NO_TARIFF

| Modalities | CT Scan, Ultrasound, X-Ray |
| Studies JSON | 0 |
| hospitalCharges radiology items | 0 |
| Charge trigger today | On request, only if a study `sell` exists (none do) |

### Pharmacy — WORKFLOW_EXISTS_BUT_NO_TARIFF

| Inventory items | 2 (Paracetamol 500mg, Examination gloves) |
| Batches | 13 |
| `inventoryPricing` | missing |
| hospitalCharges pharmacy items | 0 |
| Charge trigger | Confirmed dispense only (correct) |

### Theatre — WORKFLOW_EXISTS_BUT_NO_TARIFF

| Surgical procedures | 0 |
| Bookings | 0 |
| Charge trigger | Completed booking only (correct) |
| Theatre / anaesthesia / technician / consumable split | Not in catalogue. Do not invent. |

### Other

| Service | Status |
|---|---|
| Dental / oncology / endoscopy / ambulance | MISSING_IN_WORKFLOW and no tariff |
| Oxygen | REQUIRES_REVIEW + formula not approved. Keep uncharged. |
| Maternity services (beyond bed) | WORKFLOW_EXISTS_BUT_NO_TARIFF |

---

## C. Important mismatches

1. **The 261-row QuickBooks / mapping workbook is not in `hospitalCharges`.** Only 13 unpriced templates are there.
2. **Three separate price stores:** clinic fees, lab test prices, hospitalCharges. Clinic and lab are the only priced imports.
3. **Lab charges at order time**, not after verification.
4. **Radiology charges at order time** (when a study price exists). No study prices exist.
5. **OPD does not read hospitalCharges.** It reads `demo.clinics.consultation_fee`.
6. **137 lab tests** can be ordered with no tariff.
7. **No ICU ward** while ACC-ICU exists.
8. **Test Ward** still present.
9. **Theatre procedure master is empty.**
10. **Pharmacy items have no sell price** in settings.

---

## D. Missing tariffs (cannot price from hospitalCharges)

Every accommodation code; oxygen; emergency; all radiology; all theatre; dental; oncology; endoscopy; ambulance; 137 unpriced lab tests; both pharmacy SKUs; follow-up / walk-in / specialist rows that are not clinic names.

Priced **outside** hospitalCharges (usable today): 8 active clinic consultation fees; 55 lab tests.

---

## E. Hardcoded prices

No hospital cash amounts are hardcoded in application source for live charging.

Clinic amounts 1,000 / 1,500 / 2,000 / 2,500 live in `demo.clinics`. Lab sells live in `clinical_catalog.labTestPricing`. Specs use example numbers only.

`formatKes(0)` previously labelled a missing clinic fee as **KES 0**. That display is now **Unpriced** on OPD check-in. No price was assigned.

---

## F. Duplicate billing risks

| Risk | Assessment |
|---|---|
| Accommodation job twice | Idempotent occupancy key. Safe. |
| Lab request + later verification both charging | Today only request charges. Moving to verify later must not double-post. `upsertServiceCharge` is keyed by request id. |
| Radiology request + report both charging | Today only request. Same caution. |
| Pharmacy prescribe + dispense | Prescribe does not charge. Dispense upserts one charge per prescription group. |
| Cashier collecting without chargeId | Can create a payment not linked to a charge (existing behaviour). The two existing payments have no matching `charges` row. |
| Clinic fee + hospitalCharges consultation later | If both become priced for the same clinic, prefer one store. Not priced in hospitalCharges today. |

---

## G. Administration board

Control Center and Reports → Operations / Analytics read live counts. Charges today = 0 and collections come from the two real payments. That is correct, not mock data.

Gaps:

- Today’s charges = 0 looks like “no business” when the real issue is **unpriced catalogue**.
- No payment-method tile on Control Center home (Analytics has collections by method).
- Pending pharmacy is on IPD, not on Control Center home.
- Exceptions API exists; Control Center home does not list missed-charge rows.

---

## H. Recommended changes

### SAFE TO ALIGN NOW (done in code only; no live rows written)

- Exact-code / exact-name lookup on `hospitalCharges` as a **fallback** after clinic / lab / inventory / radiology stores.
- OPD check-in shows **Unpriced** instead of KSh 0 when a clinic has no fee.
- Do not copy lab or clinic prices into `hospitalCharges` (would duplicate live settings).
- Do not change day-count policy.
- Do not charge oxygen.

### REQUIRES HOSPITAL DECISION

- Confirm whether the QuickBooks 261-row list should be preview-imported into `hospitalCharges`.
- Lab/radiology: charge on completion/verification vs on order.
- Whether Test Ward stays.
- Whether inactive Cardiology / Dermatology clinics stay.
- Whether `director@` / “Demo *” accounts stay.
- SHA vs cash prices.

### REQUIRES MASTER DATA

- Accommodation rates for every used ward type.
- Remaining 137 lab prices, or mark those tests non-billable.
- Radiology study list + prices.
- Theatre procedure list + prices.
- Pharmacy sell prices for stock items.
- Emergency / dental / other service rows if the hospital bills them.

### DO NOT CHANGE

- Existing 2 payment rows.
- Empty `demo.charges` (do not invent charges).
- Patients, encounters, admissions.
- QuickBooks as general ledger.
- Migrations / seed flags.
- Oxygen automatic charging.

---

## Safe code changes in this pass

1. `lookupCatalogueTariff` — exact code, then exact unique name. Similar names return no match.
2. Laboratory sell sum: `labTestPricing` first; hospitalCharges only if that test has no lab sell.
3. Radiology study price: study `sell` first; hospitalCharges exact match otherwise.
4. Pharmacy dispense: inventory sell first; hospitalCharges exact SKU/name otherwise.
5. OPD check-in: **Unpriced** when clinic fee is not > 0.

No database rows were inserted, updated, or deleted.
