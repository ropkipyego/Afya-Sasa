# Jalaram Hospital configuration checklist

Use this sheet to confirm **actual** Jalaram operations before go-live.

Rules:

- Do **not** invent clinics, wards, beds, fees, rooms, stock, or roles.
- Values already in AfyaSasa are listed as **currently in system — confirm or correct**.
- Blank rows marked **REQUIRED FROM HOSPITAL** must be filled by Jalaram staff.
- Enter confirmed values in the existing Admin / IPD / Catalog screens. Do not create a second structure.
- Do not run migrations, deploy, or change production from this document.

Code convention already used in the system: department and clinic codes are `UPPER_SNAKE` (`GENERAL_OPD`, `CARDIOLOGY`, `GEN-M`).

---

## 1. Clinics and departments

Existing departments (all active in the current database): `OPD`, `ED`, `IPD`, `LAB`, `RAD`, `THEATRE`, `MATERNITY`, `CRITICAL_CARE`.

| Keep? | Department | Clinic | Code | Service | Fee (KES) | Active | Assigned clinicians | Notes |
| :---: | --- | --- | --- | --- | ---: | :---: | --- | --- |
| ☐ | OPD | General OPD | `GENERAL_OPD` | Consultation | 1000 | Yes | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | OPD | General Physician | `GENERAL_PHYSICIAN` | GP consultation | 2000 | Yes | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | OPD | ENT | `ENT` | ENT consultation | 2000 | Yes | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | OPD | Gynaecology | `GYNAECOLOGY` | Gynae consultation | 2500 | Yes | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | OPD | Orthopaedic | `ORTHOPAEDIC` | Ortho consultation | 2000 | Yes | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | OPD | Paediatrics Clinic | `PAEDIATRICS_CLINIC` | Paeds consultation | 1500 | Yes | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | OPD | Cardiology | `CARDIOLOGY` | Cardiology consultation | 2500 | **No** | REQUIRED FROM HOSPITAL | Inactive in system — activate only if this clinic operates |
| ☐ | OPD | Dermatology | `DERMATOLOGY` | Dermatology consultation | 2000 | **No** | REQUIRED FROM HOSPITAL | Inactive in system — activate only if this clinic operates |
| ☐ | Maternity | Maternity Clinic | `MATERNITY_CLINIC` | Maternity / ANC clinic | 1500 | Yes | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | OPD | Dental Clinic | `DENTAL` | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | ☐ | REQUIRED FROM HOSPITAL | Not in system. Create only if Jalaram operates this clinic |
| ☐ | OPD | Physiotherapy | `PHYSIOTHERAPY` | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | ☐ | REQUIRED FROM HOSPITAL | Not in system. Create only if Jalaram operates this clinic |
| ☐ | OPD | Oncology | `ONCOLOGY` | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | ☐ | REQUIRED FROM HOSPITAL | Not in system. Create only if Jalaram operates this clinic |
| ☐ | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | ☐ | REQUIRED FROM HOSPITAL | Any other clinic Jalaram actually runs |

Reception, Laboratory, Radiology, Pharmacy, Stores, Theatre, ICU, HDU, and Administration are **not** extra clinic rows unless Jalaram wants them on an org chart. They already map to departments, modules, or store locations.

---

## 2. Wards

Confirm every inpatient unit. Configured capacity below is what the database currently stores. It is **not** approved hospital capacity until Jalaram signs it.

| Keep? | Ward | Code | Type | Floor | Configured capacity | Physical beds now | Active | Confirm real capacity | Notes |
| :---: | --- | --- | --- | --- | ---: | ---: | :---: | ---: | --- |
| ☐ | General Ward — Male | `GEN-M` | general | 1 | 4 | 5 | Yes | REQUIRED FROM HOSPITAL | Capacity and bed count disagree |
| ☐ | General Ward — Female | `GEN-F` | general | 1 | 6 | 6 | Yes | REQUIRED FROM HOSPITAL | All current beds are `cleaning` |
| ☐ | Paediatrics | `PEDS` | paediatric | 1 | 6 | 6 | Yes | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | Surgical Private Suites | `SURG-PVT` | surgical | 2 | 4 | 4 | Yes | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | High Dependency Unit | `HDU` | hdu | 2 | 2 | 2 | Yes | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | Maternity Ward | `MAT` | maternity | 1 | 2 | 2 | Yes | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | ANC Clinic | `MAT-ANC` | maternity | Ground | 20 | **0** | Yes | REQUIRED FROM HOSPITAL | No physical beds. Confirm whether this is a ward or an OPD clinic |
| ☐ | Labour Ward | `MAT-LABOUR` | maternity | 1st | 12 | **0** | Yes | REQUIRED FROM HOSPITAL | No physical beds |
| ☐ | Postnatal Ward | `MAT-POSTNATAL` | maternity | 1st | 24 | **0** | Yes | REQUIRED FROM HOSPITAL | No physical beds |
| ☐ | Nursery | `MAT-NURSERY` | maternity | 1st | 16 | **0** | Yes | REQUIRED FROM HOSPITAL | No physical beds |
| ☐ | NICU | `MAT-NICU` | maternity | 2nd | 8 | **0** | Yes | REQUIRED FROM HOSPITAL | No physical beds |
| ☐ | Test Ward | `TEST-WARD-001` | general | — | 0 | 1 | Yes | Remove unless hospital wants it | Leftover test configuration |
| ☐ | ICU | REQUIRED FROM HOSPITAL | icu | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | 0 | ☐ | REQUIRED FROM HOSPITAL | ICU module exists. No ICU ward is configured |
| ☐ | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | — | ☐ | REQUIRED FROM HOSPITAL | Any other real ward |

---

## 3. Beds

List every real bed Jalaram uses. Existing physical beds are below. Do not add placeholder beds.

| Keep? | Ward | Bed number | Bed type | Status now | Confirm type | Confirm status | Notes |
| :---: | --- | --- | --- | --- | --- | --- | --- |
| ☐ | GEN-M | GEN-01 | standard | cleaning | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | GEN-M | GEN-02 | standard | cleaning | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | GEN-M | GEN-03 | standard | cleaning | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | GEN-M | GEN-04 | standard | cleaning | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | GEN-M | GEN-M-05 | standard | cleaning | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Extra bed vs configured capacity of 4 |
| ☐ | GEN-F | GEN-F-01 | standard | cleaning | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | GEN-F | GEN-F-02 | standard | cleaning | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | GEN-F | GEN-F-03 | standard | cleaning | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | GEN-F | GEN-F-04 | standard | cleaning | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | GEN-F | GEN-F-05 | standard | cleaning | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | GEN-F | GEN-F-06 | standard | cleaning | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | PEDS | PEDS-01 | paediatric | available | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | PEDS | PEDS-02 | paediatric | available | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | PEDS | PEDS-03 | paediatric | available | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | PEDS | PEDS-04 | paediatric | available | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | PEDS | PEDS-05 | paediatric | available | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | PEDS | PEDS-06 | paediatric | available | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | SURG-PVT | PVT-01 | standard | available | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | SURG-PVT | PVT-02 | standard | occupied | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Occupied by JH-2026-00012 — do not reuse |
| ☐ | SURG-PVT | PVT-03 | standard | available | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | SURG-PVT | PVT-04 | standard | available | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | HDU | HDU-01 | icu | cleaning | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | HDU | HDU-02 | icu | occupied | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Occupied by leftover test admission — authorised clinician must cancel/discharge |
| ☐ | MAT | MAT-01 | maternity | occupied | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Occupied by leftover test admission — authorised clinician must cancel/discharge |
| ☐ | MAT | MAT-02 | maternity | cleaning | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Currently in system — confirm or correct |
| ☐ | TEST-WARD-001 | TEST-BED-001 | standard | available | Remove unless hospital wants it | — | Leftover test bed |
| ☐ | ICU | REQUIRED FROM HOSPITAL | icu | — | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | No ICU beds exist |
| ☐ | MAT-ANC | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | — | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Only if this is a real bedded unit |
| ☐ | MAT-LABOUR | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | — | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Only if this is a real bedded unit |
| ☐ | MAT-POSTNATAL | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | — | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Only if this is a real bedded unit |
| ☐ | MAT-NURSERY | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | — | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Only if this is a real bedded unit |
| ☐ | MAT-NICU | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | — | REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | Only if this is a real bedded unit |

Allowed bed types already in software: `standard`, `icu`, `isolation`, `paediatric`, `maternity`, `cardiac`.  
Allowed statuses: `available`, `reserved`, `occupied`, `maintenance`, `inactive`, `cleaning`. Occupied is set by admission, not by hand.

---

## 4. ICU and HDU

| Item | Currently in system | Hospital decision |
| --- | --- | --- |
| HDU ward | `HDU`, 2 beds (`HDU-01`, `HDU-02`) | Confirm name, capacity, and bed numbers |
| ICU ward | None | REQUIRED FROM HOSPITAL: create only if Jalaram has an ICU, with code, floor, and bed list |
| ICU vs HDU bed type | HDU beds are stored as type `icu` | Confirm whether that label is acceptable |

---

## 5. Maternity

| Unit | Currently in system | Physical beds | Hospital decision |
| --- | --- | ---: | --- |
| Maternity Clinic (OPD) | `MATERNITY_CLINIC` under Maternity | n/a | Confirm it is an outpatient clinic |
| Maternity Ward | `MAT` with MAT-01, MAT-02 | 2 | Confirm real postnatal / lying-in beds |
| ANC / Labour / Postnatal / Nursery / NICU | Wards exist with configured counts 20 / 12 / 24 / 16 / 8 | 0 | REQUIRED FROM HOSPITAL: either supply bed numbers or deactivate these wards if they are not bedded units |

---

## 6. Theatre

| Theatre code | Theatre name | Status | Hospital decision |
| --- | --- | --- | --- |
| REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | — | No theatre rooms are configured. Add only real operating rooms via Theatre setup |
| REQUIRED FROM HOSPITAL | REQUIRED FROM HOSPITAL | — | Additional room if needed |

Procedure catalogue can be imported later. Do not invent procedures here.

---

## 7. Pharmacy and Main Store

Locations already in the system (confirm names only):

| Keep? | Location code | Name | Type | Notes |
| :---: | --- | --- | --- | --- |
| ☐ | `PHARMACY` | Pharmacy Store | pharmacy | Medicines and patient dispensing |
| ☐ | `MAIN_STORE` | Main Store | main_store | Supplies and non-pharmacy stock |
| ☐ | `WARD-GENERAL` | General Ward | ward | Destination for issues — confirm whether this ward store is real |

Do not merge pharmacy and main store. Do not create fake stock.

| Item | Hospital must supply |
| --- | --- |
| Pharmacy catalogue (SKU, name, unit, batch/expiry tracking) | REQUIRED FROM HOSPITAL — current pharmaceutical catalogue has 1 item |
| Main store catalogue (medical consumables and non-medical) | REQUIRED FROM HOSPITAL — current consumable catalogue has 1 item |
| Opening balances | REQUIRED FROM HOSPITAL — do not invent quantities |
| Minimum / maximum levels | REQUIRED FROM HOSPITAL — columns are not in the database until the pending inventory migration is applied after backup |

Existing item import: Admin / catalogs inventory CSV. Use hospital SKUs only.

---

## 8. Roles and staff

System roles already present. Tick who should hold each role. Do not create extra roles unless Jalaram has a job that cannot use one of these.

| Role in AfyaSasa | Typical hospital job | Named staff (email) | Hospital decision |
| --- | --- | --- | --- |
| `records_officer` | Reception / records | REQUIRED FROM HOSPITAL | Use for registration, search, OPD check-in |
| `doctor` | Doctor / clinical officer | REQUIRED FROM HOSPITAL | Confirm each clinician and specialisation |
| `nurse` | Nurse | REQUIRED FROM HOSPITAL | IPD, MAR, observations |
| `lab_technician` | Lab technician | REQUIRED FROM HOSPITAL | Lab requests, samples, results |
| `radiology_technician` | Radiographer | REQUIRED FROM HOSPITAL | Radiology workflow |
| `administrator` | Hospital admin | REQUIRED FROM HOSPITAL | Account Control and configuration |
| `superadmin` | Protected system admin | Keep tightly limited | Do not assign for daily clinical work |

Accounts already in the local system (confirm whether each is a real Jalaram user):

| Email | Name | Current role(s) | Active | Keep / disable / change role |
| --- | --- | --- | :---: | --- |
| admin@jalaram.co.ke | LAMYA ABDULLAH | administrator | Yes | REQUIRED FROM HOSPITAL |
| beatrice@jalaram.co.ke | BEATRICE MURAYA | administrator | Yes | REQUIRED FROM HOSPITAL |
| carlos.nurse@jalaram.co.ke | CARLOS NGENO | nurse | Yes | REQUIRED FROM HOSPITAL |
| cpangare.symon@gmail.com | SIMON NGARE | administrator | Yes | REQUIRED FROM HOSPITAL |
| director@jalaram.co.ke | Test Director | administrator | Yes | REQUIRED FROM HOSPITAL |
| doctor@jalaram.co.ke | Demo Doctor | doctor | Yes | REQUIRED FROM HOSPITAL |
| ecccoloise@jalaram.co.ke | WANJIKU LOISE | doctor | Yes | REQUIRED FROM HOSPITAL |
| it@demo.afyasasa.local | BRIAN KIPYEGON | administrator | No | Already inactive — confirm |
| it@jalaram.co.ke | IT Admin | administrator, superadmin | Yes | REQUIRED FROM HOSPITAL |
| lab@jalaram.co.ke | Demo Lab | lab_technician | Yes | REQUIRED FROM HOSPITAL |
| loise@jalaram.co.ke | LOISE MUTHEU | records_officer | Yes | REQUIRED FROM HOSPITAL |
| m.ali@jalaram.co.ke | MUSTAFA ALI | doctor | Yes | REQUIRED FROM HOSPITAL |
| nurse@jalaram.co.ke | Demo Nurse | nurse | Yes | REQUIRED FROM HOSPITAL |
| p3.acctest.1789116718@jalaram.test | Phase3Kept Acctest | doctor | No | Test account — confirm disable |
| radiology@jalaram.co.ke | Demo Radiology | radiology_technician | Yes | REQUIRED FROM HOSPITAL |

There is **no** seeded pharmacist, storekeeper, marketer, dentist, or physiotherapist role. If Jalaram needs those job titles, say so; otherwise assign:

- Pharmacy dispensing → a named nurse/pharmacist using `pharmacy:dispense` via an existing role or a new role created in Account Control
- Main store → `inventory:*` on a named administrator or a new store role
- Marketing → only after the pending marketing migration; then grant `marketing:*` to named marketers

---

## 9. Insurers

Default schemes in software. Tick those Jalaram actually accepts. Do not add live verification for a scheme that has no integration.

| Use? | Scheme value | Label | How it is recorded | Hospital notes |
| :---: | --- | --- | --- | --- |
| ☐ | `sha` | SHA (Social Health Authority) | Patient ID + eligibility check | Live HIE only if credentials exist; otherwise recorded / practice / unavailable |
| ☐ | `smart` | Smart | Manual payer on payment | No live Smart API |
| ☐ | `nhif` | NHIF (legacy) | Manual | Confirm whether still used |
| ☐ | `jubilee` | Jubilee Insurance | Manual | Confirm whether accepted |
| ☐ | `aar` | AAR Insurance | Manual | Confirm whether accepted |
| ☐ | `britam` | Britam | Manual | Confirm whether accepted |
| ☐ | `cic` | CIC Insurance | Manual | Confirm whether accepted |
| ☐ | `corporate` | Corporate / employer scheme | Manual | REQUIRED FROM HOSPITAL: employer names if used |
| ☐ | `other` | Other insurer | Manual | REQUIRED FROM HOSPITAL: write the real name |

SHA decision (pick one):

- ☐ Live HIE — hospital will supply facility FR code and credentials
- ☐ Practice / disconnected — staff record SHA IDs only; UI must not say verified

---

## 10. Isolated UAT (after this sheet is filled)

Do this on local/isolated data only. Use a name such as `TEST_PATIENT_DO_NOT_USE`. Do not create permanent production patients.

1. Register the synthetic patient (adult and, separately, a minor with guardian).
2. Search by name, phone, and patient number.
3. Open the patient file.
4. Check into a **confirmed** clinic.
5. Open consultation and place an order only if that catalogue item is real.
6. Admit to a **confirmed available** bed (not PVT-02, HDU-02, or MAT-01 while occupied).
7. Record a MAR status change.
8. Transfer to another **confirmed available** bed.
9. Complete a discharge summary, then download the PDF and confirm it opens.
10. Confirm the bed is no longer occupied.
11. Cancel a second synthetic admission and confirm the encounter is no longer `admitted`.
12. Delete or clearly inactivate the synthetic patient when finished.

Pending work that is **not** part of filling this sheet:

- Marketing foundation migration `1768300000000` — apply only after backup, when Jalaram is ready
- Inventory reorder columns `1768400000000` — apply only after backup, when min/max levels are supplied

---

## 11. Sign-off

| Role | Name | Date | Confirms |
| --- | --- | --- | --- |
| Hospital administrator | REQUIRED FROM HOSPITAL | | Clinics, roles, insurers |
| Nursing / IPD in-charge | REQUIRED FROM HOSPITAL | | Wards, beds, ICU, maternity |
| Theatre in-charge | REQUIRED FROM HOSPITAL | | Theatre rooms |
| Pharmacy / stores | REQUIRED FROM HOSPITAL | | Catalogues and locations |
| AfyaSasa operator | | | Values entered match this signed sheet |
