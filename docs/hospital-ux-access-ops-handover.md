# Hospital-wide UX, access, administration and operations — local handover

**Date:** 2026-10-13  
**Branch:** `main` plus uncommitted local work. **Not committed or pushed.**

LIVE STACK CHANGED: **NO**  
LIVE DATABASE CHANGED: **NO**  
PRODUCTION MIGRATIONS APPLIED: **NONE**  
PRODUCTION DEPLOYMENT PERFORMED: **NO**  
COMMITS/PUSHES: **NONE**

## Before / after navigation

| Before | After |
| --- | --- |
| Many groups always expanded (Front Office, Queue, Pharmacy, Outpatient) | Groups collapsed unless the user opens them or the active screen is inside |
| Queue Management, Outpatient, Imaging, Specialty, Supply, Administration | Dashboard, Front Office, Clinical Services, Diagnostics, Specialty & Procedures, Pharmacy & Supply, Finance, Documents & Reports, Marketing & Outreach, Management & Intelligence, Hospital Control Center |
| Duplicate mental model: Reports vs Director in the same Reports group | Director sits under Management; Reports under Documents & Reports |

Deep-link aliases for retired labels remain in `screen-aliases.ts`.

## Role / permission matrix

Templates are **starting sets** filtered to keys that exist in the live permission catalogue. Superadmin is not a template. Saving a role assigned to yourself cannot add rights you do not already hold.

Templates: records officer, doctor, nurse, lab technician, lab verifier, radiology technician, pharmacist, store officer, cashier, insurance officer, department head, director, hospital administrator, IT support.

Department scope in JWT is unchanged; hiding a menu is still not authorisation.

## Lab samples and Ministry forms

Five Jalaram DOCX cards (CRP, UEC+PSA, stool OC / H. pylori, CBC, LFT) were used as **layout** sources. Official HTML now matches the hospital card (tagline, patient header, Test | Result | Units | Flag | Ref Interval, FLAG KEY, footer). **Patient identifiers and result values from those samples were not copied.** Intervals remain catalogue-sourced. MOH mapping (`GET /reports/moh/mapping`) records 705A/B, 706, 717 as internal projections and 204A/333 as **requires official spec**. Electronic KHIS submission: **not operational**.

## Email / SMS

Jalaram SMTP is aligned locally: `mail.jalaram.co.ke:465` implicit TLS, `noreply@jalaram.co.ke`. **EMAIL_DELIVERY_ENABLED remains false.** Mailbox password is not in Git or the UI. Password reset emails go only to **active** staff; if `EMAIL_RECIPIENT_ALLOWLIST` is set, only those addresses receive a token. Generic response is unchanged. Single sign-in OTP stays **off**. SMS bulk send is **preview only**.

HTTP 404 HTML: `frontend/public/404.html`, `/404` in the SPA, and browser-facing Nest 404/5xx when `Accept: text/html`.

## Patient export

`GET /exports/patients/fields|preview|download` requires `patients:read` **and** `reports:read`. Field allowlist excludes passwords/tokens. Bounded to 5000 rows.

## System health

`/admin/system-health` now PING Redis, `SELECT 1` Postgres, and HEAD object storage. States: Healthy, Degraded, Unavailable, Not Configured, Unknown. `/health` remains a liveness probe only.

## Backup

Inventory UI lists postgres / minio / redis / config. Restore from UI is **403**. `ops/backup-postgres.sh` still exists. Isolated restore was **not** executed (no isolated PG proven).

## Department collections

Lab, pharmacy, radiology, IPD, theatre, and cashier headers show 30-day **charges and collections** for their `serviceLine` from the existing cashier ledger (`GET /reports/department-revenue`). Directors see all lines on the executive dashboard. **Not QuickBooks.** Pharmacy stock take import/confirm behaviour was not changed.

## Tests not run

Browser Back against a live isolated database. Isolated restore. Official MOH template pixel match. Live SHA/FHIR/SMTP connectivity. Production go-live.
