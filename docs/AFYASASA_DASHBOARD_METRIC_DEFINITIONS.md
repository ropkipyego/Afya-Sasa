# AfyaSasa dashboard metric definitions

Canonical calculations for Director, Operations, and Marketing screens. All values come from existing `demo` tables. Zero means the query returned zero rows. `Data unavailable` means the source is missing, hidden, or not configured.

QuickBooks remains the accounting/GL system. Payments are never labelled revenue.

| Metric | Source table | Date field | Filters / status | Calculation | Notes |
| --- | --- | --- | --- | --- | --- |
| OPD visits | `demo.encounters` | `started_at` | `type = 'opd'` | `COUNT(*)` in selected range | Same definition on analytics and operations (`patientsToday` = OPD started today). |
| New patients | `demo.patients` | `created_at` | not soft-deleted | `COUNT(*)` in range | Registrations, not visits. |
| Emergency visits | `demo.emergency_encounters` | `created_at` | none beyond range | `COUNT(*)` | Presentation count, not disposition. |
| Admissions | `demo.admissions` | `admitted_at` | none beyond range | `COUNT(*)` | Includes later-discharged stays that started in range. |
| Discharges | `demo.admissions` | `discharged_at` | `status = 'discharged'` | `COUNT(*)` | Uses discharge timestamp, not admission date. |
| Current inpatients | `demo.admissions` | query time | `status = 'active'` | `COUNT(*)` | Point-in-time. Not filtered by dashboard date range. |
| Bed occupancy | `demo.beds` | query time | occupied / all beds | `occupied / total * 100` | `Data unavailable` when `totalBeds = 0`. |
| Appointments | `demo.appointments` | `appointment_date` | date in range | `COUNT(*)` | Scheduled date, not created-at. |
| Pending laboratory work | `demo.lab_requests` | query time | `status IN (requested, sample_collected, processing, resulted)` | `COUNT(*)` | Point-in-time worklist. |
| Pending lab verification | `demo.lab_requests` | query time | `status = 'resulted'` | `COUNT(*)` | Awaiting verify. |
| Pending radiology work / reports | `demo.radiology_requests` | query time | `status IN (requested, scheduled, in_progress)` | `COUNT(*)` | Point-in-time. |
| Theatre activity | `demo.surgery_bookings` | `scheduled_start_at` | in range / today | `COUNT(*)` | Scheduled start, not completion. |
| Pharmacy activity | — | — | — | Data unavailable | No Director aggregate yet. Do not invent from inventory movements. |
| Unassigned OPD encounters | `demo.encounters` | query time | `type=opd`, status in waiting/triaged/in_consultation, `attending_doctor_id IS NULL` | `COUNT(*)` | Links to Doctor Queue. |
| Patients waiting for doctor | `demo.encounters` | query time | `type=opd`, status in waiting/triaged | `COUNT(*)` | Includes assigned and unassigned. |
| Pending discharge summaries | `demo.discharge_summaries` + `demo.admissions` | query time | admission `active`, summary `draft` | `COUNT(*)` | There is no `pending_discharge` admission status. |
| Bed conflicts | `demo.admissions` | query time | `status=active`, same `bed_id`, count > 1 | `COUNT(distinct bed_id)` | Silent double-occupancy. |
| Charges generated | `demo.charges` | `created_at` | range | `SUM(amount_owed)` | Hidden unless director/admin/superadmin or `payments:read`/`settings:manage`. Genuine 0 when table is empty. |
| Payments received | `demo.payment_transactions` | `created_at` | `status = completed` | `SUM(amount)` | Not called revenue. |
| Outstanding balances | `demo.charges` | query time | `status IN (owed, partially_paid)` | `SUM(owed - paid - waived)` | Point-in-time, not range-sliced. |
| Accommodation charges | `demo.charges` | `created_at` | inpatient line or metadata.source=ACCOMMODATION | `SUM(amount_owed)` | Requires priced catalogue + charges enabled. |
| Accounting / QuickBooks balance | — | — | — | Data unavailable | Display: Accounting integration pending. |
| Marketing activities | `demo.marketing_visits` | `activity_date` | owner scope | `COUNT(*)` | Field outreach. Not a second patient register. |
| Enquiries by source / campaign conversion | — | — | — | Insufficient attribution data | No enquiry↔appointment↔patient link exists. Do not invent rates. |
