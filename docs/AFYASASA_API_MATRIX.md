# AfyaSasa API matrix

| Area | Status | Notes |
| --- | --- | --- |
| Auth | WORKING | JWT + refresh cookie + lockout + throttle |
| Patients | WORKING | Single patient table; CR type ready, unused live |
| OPD encounters | WORKING | Open-visit guard same Nairobi day |
| Doctor queue | FIXED | Backend assignment scope + realtime publish |
| Triage | WORKING | Assigned-doctor notification |
| Consultations | WORKING | Sets attending doctor on first SOAP |
| Appointments | WORKING | Follow-up created on complete if dated |
| Visit queue tokens | WORKING | |
| IPD / beds | WORKING | cleaning status present |
| Nursing | WORKING | |
| Emergency | WORKING | |
| Maternity | WORKING | Operational, not official MOH333 |
| ICU / HDU | WORKING | |
| Lab requests/results/samples | WORKING | Specimen barcode table exists |
| Radiology | WORKING | Unpriced studies do not auto-charge |
| Theatre | WORKING | Charge only completed + priced |
| Pharmacy / inventory | WORKING | SKU identity; no barcode column |
| Charges / payments | WORKING | Zero price not billable; 0 charge rows live |
| Charge catalogue | WORKING | 13 unpriced templates + clinic/lab prices |
| SHA eligibility | REQUIRES DHA CREDENTIALS | 0 live checks |
| SHR / consent / claims | BACKEND ROUTE MISSING | Do not stub |
| MOH 705A/B 706 717 | WORKING | Internal projection only |
| Other MOH registers | REQUIRES OFFICIAL MOH SPEC | |
| Admin / RBAC / audit | WORKING | |
| System health | WORKING BUT WEAK | Public /health is liveness only |
| Storage / MinIO | WORKING | |
| Worklists | WORKING | Paginated |
| QuickBooks queue | WORKING BUT WEAK | Not a second GL |
| M-Pesa | WORKING BUT WEAK | Public callback |

Full route list: `docs/AFYASASA_API_AUDIT.md`.
