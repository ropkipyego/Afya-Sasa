# Jalaram Hospital — AfyaSasa system assessment

**Prepared for:** Hospital system administrator  
**Facility:** Jalaram Hospital  
**System:** AfyaSasa clinical EMR (live hospital instance)  
**Access URL:** http://localhost:8080  
**Date of this brief:** 26 September 2026  

This note is for assessment, not software development. It describes what is live, how to sign in, what to test, and what still needs a hospital decision. Figures below were read from the running hospital database on this date.

---

## 1. What this system is

AfyaSasa is the hospital’s operational EMR: registration, clinical work, inpatient, laboratory, imaging, pharmacy, theatre, cashier, and management reports.

It is **not** the hospital’s accounting system. **QuickBooks remains the general ledger.** AfyaSasa posts operational charges and collections. It does not keep a second patient register, a second payment ledger, or a hospital general ledger.

---

## 2. Current running status

Checked on this host:

| Service | Status |
|---|---|
| Hospital web address (`:8080`) | Responding |
| Application programming interface | Healthy |
| Database | Healthy |
| File storage | Healthy |
| Session store | Healthy |

Staff who already have a password can sign in now. After a software rebuild, if the page shows “502 Bad Gateway”, only the web proxy needs a restart. Do not reset the database.

---

## 3. How to sign in (assessment)

1. Open **http://localhost:8080**
2. Use a **hospital administrator** email from section 4
3. Use the password already issued by the hospital  
   The old installation default is **no longer valid**. Do not ask developers to reset passwords unless the hospital authorises it.
4. After login, open:
   - **Admin** — Hospital Control Center
   - **Reports → Analytics** — Director figures
   - **Reports → Operations** — today’s activity
   - **Inpatient (IPD)** — ward board and patient account
   - **Finance** — cashier

**IT Admin** (`it@jalaram.co.ke`) has both hospital administrator and platform super-admin rights. Use that account for a full assessment if the password is known.

---

## 4. Staff accounts (live)

Passwords are not listed here. They stay with the hospital.

### Administrators (can open Control Center)

| Email | Name | Rights | Notes for assessment |
|---|---|---|---|
| it@jalaram.co.ke | IT Admin | Administrator + Super admin | Last signed in 26 Sep 2026. Use this for the full review. |
| admin@jalaram.co.ke | LAMYA ABDULLAH | Administrator | Last signed in 23 Sep 2026. |
| beatrice@jalaram.co.ke | BEATRICE MURAYA | Administrator | Never signed in. Must set a password on first login. |
| cpangare.symon@gmail.com | SIMON NGARE | Administrator | Last signed in 28 Aug 2026. Confirm this is a real hospital officer. |
| director@jalaram.co.ke | Test Director | Administrator | Never completed a login. Must set a password on first login. Confirm whether this account should remain. |

### Clinical accounts currently active

| Email | Name | Role |
|---|---|---|
| doctor@jalaram.co.ke | Demo Doctor | Doctor — confirm rename or replacement |
| ecccoloise@jalaram.co.ke | WANJIKU LOISE | Doctor |
| m.ali@jalaram.co.ke | MUSTAFA ALI | Doctor — must set password on first login |
| nurse@jalaram.co.ke | Demo Nurse | Nurse — confirm rename or replacement |
| carlos.nurse@jalaram.co.ke | CARLOS NGENO | Nurse |
| loise@jalaram.co.ke | LOISE MUTHEU | Records officer |
| lab@jalaram.co.ke | Demo Lab | Laboratory |
| radiology@jalaram.co.ke | Demo Radiology | Radiology |

### Accounts the hospital should review or disable

| Email | Why |
|---|---|
| it@demo.afyasasa.local | Already inactive. Leave inactive. |
| phase1.admin.uat@jalaram.test | Leftover test administrator. Disable if no longer needed. |
| phase1.nurse.uat@jalaram.test | Leftover test nurse. Disable if no longer needed. |
| phase1.records.uat@jalaram.test | Leftover test records login. Disable if no longer needed. |
| p3.acctest.1789116718@jalaram.test | Already inactive. Leave inactive. |

There is no dedicated pharmacist or storekeeper role yet. Pharmacy work uses existing clinical or administrator rights. Create a pharmacist role in **Admin → Roles & permissions** if the hospital wants a separate job title.

---

## 5. Live records (this date)

These are real hospital records on this instance, not sample seed data loaded today.

| Record | Count |
|---|---|
| Registered patients | 26 |
| Encounters (all types) | 73 |
| Admissions (all time) | 21 |
| Active staff logins | 16 |
| Operational charges posted | 0 |
| Payment transactions | 2 |

**Why charges are zero:** automatic accommodation and service charging will not invent a price. Until the hospital enters cash tariffs in **Admin → Hospital charge catalogue**, the system correctly posts **no** accommodation or service charge. Collections that already exist remain on the payment ledger.

---

## 6. What is in place for assessment

### Front office and outpatient

- Patient search, registration, and patient file
- OPD check-in, appointments, triage, doctor consultation
- Referrals and sick sheets
- Queues: triage, doctor, laboratory, pharmacy, imaging, hospital-wide board

### Inpatient

- Ward board: admissions today, transfers, discharges, occupied / available / cleaning beds
- Patient workspace: Clinical, Nursing, Orders, Medication, Laboratory, Radiology, Theatre, Account
- Account shows **Charges, Paid, Outstanding** and a line timeline
- Bed transfers keep the historical ward period (not “current bed × days”)
- Clinical discharge is separate from the bill. Outstanding balance is visible; it does not automatically block discharge unless the hospital turns that policy on

### Laboratory, imaging, pharmacy, theatre

- Laboratory catalog, requests, results
- Radiology catalog, requests, reports
- Pharmacy dispense with stock deduction on confirmed dispense
- Theatre booking → completion. A theatre charge is created only when the procedure is **completed** and a hospital price exists

### Finance (operational, not accounting)

- One hospital charge catalogue for OPD, IPD, laboratory, imaging, pharmacy, theatre, and other services
- Cashier: patient, charge lines, paid, outstanding, cash / M-Pesa / card / bank, receipt, staged payments
- Waivers, discounts, and refunds keep the original charge amount and record who did it and why
- Daily cash-point close
- Missed-charge list (read only). It highlights a gap; it does not create a charge by itself
- QuickBooks remains the ledger. AfyaSasa can later export mappings; it must not become a second GL

### Administration

Hospital Control Center (sidebar **Admin**):

- Hospital profile, branding, facilities, departments, clinics
- Users and access, roles and permissions
- Wards and beds
- Laboratory, radiology, theatre, maternity catalogs
- Service catalog import (preview, then approve)
- Clinic consultation fees
- Hospital charge catalogue
- SHA eligibility (check cover; do not treat a typed SHA number as verified)
- Reports, audit, security, backup notes, system health
- Super admin (IT Admin only)

### Director / management

- **Reports → Analytics:** patients, OPD, admissions, discharges, occupancy, charges, collections, outstanding, department revenue, payment method, ageing. Figures come from hospital records only.
- **Reports → Operations:** today’s activity plus today’s charges, collections, and outstanding
- **Admin home:** the same “today” tiles for administrators

---

## 7. What the system will not do (by design)

- Invent hospital prices or SHA tariffs
- Post a KSh 0 charge
- Charge because something was only booked or prescribed
- Charge oxygen automatically until the hospital approves the quantity rule
- Overwrite an old charge when a new tariff is entered
- Replace QuickBooks
- Load sample patients or sample bills

---

## 8. Hospital decisions still required

These items block “complete” financial go-live. Clinical work can continue without them.

1. Enter cash prices in **Hospital charge catalogue**. Empty means “do not charge”.
2. Confirm the IPD day-count rule (current default: calendar days, exclude discharge day, charge at least one day for a same-day stay, morning bed owns a transfer day).
3. Approve or reject import of the QuickBooks service list. Do not import the raw accounting file (COGS, VAT, supplier, stock-on-hand).
4. Classify any zero-price QuickBooks rows: priced, not billable, or wait for a hospital rate.
5. Approve the oxygen billing formula (litres vs flow × time vs measured use).
6. Set anaesthesia / sedation / walk-in rates, or leave them unpriced.
7. Supply SHA / insurance allowable amounts if they differ from cash.
8. Decide whether an unpaid bill may block clinical discharge.
9. Confirm or disable leftover test logins listed in section 4.
10. Rename or replace accounts still labelled “Demo Doctor”, “Demo Nurse”, “Demo Lab”, “Demo Radiology”, “Test Director”.
11. Confirm Simon Ngare’s Gmail administrator login is authorised.

---

## 9. Suggested assessment walk-through

Use **existing** patients and **existing** staff. Do not register a new patient unless the hospital authorises a named test file.

| Step | Where | What “good” looks like |
|---|---|---|
| 1 | Login | Administrator reaches the hospital home screen |
| 2 | Admin | Today tiles show real counts (patients, OPD, admissions, occupancy). No invented revenue. |
| 3 | Admin → Users | Named staff appear. Leftover test emails are visible for disable/keep. |
| 4 | Admin → Hospital charge catalogue | Services list. Empty rates stay empty. Search and paging work. |
| 5 | Admin → Clinic consultation fees | Clinic amounts, if already set, match cashier |
| 6 | Reports → Analytics | Choose Today / 7 days / 30 days. Numbers move with the range. Charges and collections are labelled separately. |
| 7 | Reports → Operations | Same-day activity plus charges / collections / outstanding |
| 8 | Inpatient | Active inpatients, beds, pending lab / pharmacy / imaging |
| 9 | Open one inpatient → Account | Totals and lines. If rates are empty, it says price is not configured — it must not invent KSh 0. |
| 10 | Finance | Search a known patient. Charge lines and payments appear if any exist. |
| 11 | Laboratory / Imaging / Pharmacy | Queues open. Dispense still deducts stock only when confirmed. |
| 12 | Theatre | A booking alone must not create a charge. |

If any screen shows empty money figures, that is expected until tariffs are entered (section 5 and 8).

---

## 10. Progress summary for sign-off

| Area | State |
|---|---|
| Live hospital instance running | Ready for staff access |
| Patient, OPD, IPD, ED, lab, imaging, pharmacy, theatre | In use on this instance |
| Users and role control | In use. Some display names and leftover test logins need hospital cleanup |
| Cashier and receipts | In use (2 payments on file) |
| Charge catalogue and IPD account | Built. Waiting for hospital prices before charges post |
| Director analytics and operations | Built on live records |
| SHA eligibility | Framework only. No SHA tariff assumptions |
| QuickBooks as general ledger | Unchanged. No duplicate ledger |
| Sample-data banners and “coming soon” finance text | Removed from staff-facing operations and analytics screens |
| Isolated new-patient billing UAT | Not done. Needs a hospital-authorised test patient |

---

## 11. Request to the system administrator

Please walk sections 3, 4, 6, and 9, then record:

- Which administrator accounts stay, and which to disable  
- Whether the charge catalogue prices will be entered by finance, and by when  
- Whether Director analytics is acceptable for management use  
- Any screen that does not match hospital procedure  

Return those notes to the project owner. Do not apply database migrations, do not load sample data, and do not reset staff passwords unless the hospital director authorises it.
