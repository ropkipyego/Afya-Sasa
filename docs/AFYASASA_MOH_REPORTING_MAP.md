# AfyaSasa MOH reporting map

Inspection date: 2 October 2026.

Official KHIS/DHIS submission APIs and HRI class definitions for 107A/107B were **not** present in this repository or facility pack. This map therefore classifies each tool. It does not invent submission requirements.

## Architecture in use

```text
Canonical records (patient, encounter, diagnosis, lab result, admission, delivery, …)
    → MohReportsService / ReportingService projection
        → JSON for screen
        → optional DOCX if a template is uploaded in Document Templates
            → Generate / Validate locally / Export / Print / Archive
```

There are no `patient_moh204a` or similar per-register patient tables. Keep it that way.

Implemented report endpoints:

| Code | Endpoint | Source projection | Submission status |
| --- | --- | --- | --- |
| MOH705 (legacy) | GET /reports/moh-705 | OPD disease-style counts | INTERNAL / FACILITY SUMMARY |
| MOH705A | GET /reports/moh-705a + /docx | Under-5 OPD from encounters + diagnoses + age | INTERNAL REGISTER / MANUAL SUBMISSION |
| MOH705B | GET /reports/moh-705b + /docx | Over-5 OPD | INTERNAL REGISTER / MANUAL SUBMISSION |
| MOH706 | GET /reports/moh-706 + /docx | Laboratory | INTERNAL / MANUAL SUBMISSION |
| MOH717 | GET /reports/moh-717 + /docx | Service workload | FACILITY SUMMARY / MANUAL SUBMISSION |

`GET /reports/moh/auto-run` rebuilds the current month internally. It is not KHIS upload.

Other operational reports (OPD summary, admissions, discharges, beds, emergency, theatre, maternity, ICU, referrals, disease register, intelligence) are hospital management reports, not official MOH tools.

## Supplied register inventory

| Tool | Canonical source if generated later | Current status | Submission |
| --- | --- | --- | --- |
| MOH204A Under 5 OPD | Encounter + age + diagnosis | NOT IMPLEMENTED as 204A (705A is the related summary) | REQUIRES OFFICIAL MOH SPEC |
| MOH204A Over 5 OPD | Encounter + age + diagnosis | NOT IMPLEMENTED as 204A (705B related) | REQUIRES OFFICIAL MOH SPEC |
| MOH209 X-ray | radiology_requests / reports | NOT IMPLEMENTED | INTERNAL REGISTER ONLY until spec |
| MOH240B Hematology | lab requests/results + department | NOT IMPLEMENTED (706 is aggregate lab) | REQUIRES OFFICIAL MOH SPEC |
| MOH240C Laboratory | lab | partial via 706 | MANUAL SUBMISSION |
| MOH240D Parasitological | lab department | NOT IMPLEMENTED | REQUIRES OFFICIAL MOH SPEC |
| MOH240E Bacteriology | lab department | NOT IMPLEMENTED | REQUIRES OFFICIAL MOH SPEC |
| MOH240F Clinical Chemistry | lab department | NOT IMPLEMENTED | REQUIRES OFFICIAL MOH SPEC |
| MOH240G Urinalysis | lab department | NOT IMPLEMENTED | REQUIRES OFFICIAL MOH SPEC |
| MOH262 Cervical cancer | procedure / gynae findings | NOT IMPLEMENTED | REQUIRES OFFICIAL MOH SPEC |
| MOH301 Inpatient | admissions + diagnoses | NOT IMPLEMENTED as 301 | REQUIRES OFFICIAL MOH SPEC |
| MOH333 Maternity | maternity deliveries | operational maternity report only | REQUIRES OFFICIAL MOH SPEC |
| MOH361A / 361B ART | HIV program data | NOT IN CANONICAL MODEL | REQUIRES PROGRAM + SPEC |
| MOH362 HTS | HIV testing | NOT IN CANONICAL MODEL | REQUIRES PROGRAM + SPEC |
| MOH363 Postrape | SGBV / emergency | NOT IMPLEMENTED | REQUIRES OFFICIAL MOH SPEC |
| MOH365 SGBV | SGBV | NOT IMPLEMENTED | REQUIRES OFFICIAL MOH SPEC |
| MOH366 DAR CCC | HIV | NOT IN CANONICAL MODEL | REQUIRES PROGRAM + SPEC |
| MOH405 ANC | maternity ANC visits | data exists, form not mapped | REQUIRES OFFICIAL MOH SPEC |
| MOH406 PNC | postnatal visits | data exists, form not mapped | REQUIRES OFFICIAL MOH SPEC |
| MOH407A/B Nutrition | nutrition observations | NOT IN CANONICAL MODEL | REQUIRES OFFICIAL MOH SPEC |
| MOH408 HEI | HEI follow-up | NOT IN CANONICAL MODEL | REQUIRES PROGRAM + SPEC |
| MOH710A/B Supplementary feeding | commodities | NOT IN CANONICAL MODEL | REQUIRES OFFICIAL MOH SPEC |
| MOH510 Immunization | immunizations | NOT IN CANONICAL MODEL | REQUIRES OFFICIAL MOH SPEC |
| MOH511 CWC | child welfare | NOT IN CANONICAL MODEL | REQUIRES OFFICIAL MOH SPEC |
| MOH512 Contraceptives | FP encounters | NOT IN CANONICAL MODEL | REQUIRES OFFICIAL MOH SPEC |
| PEP Register | emergency + pharmacy | NOT IMPLEMENTED | REQUIRES OFFICIAL MOH SPEC |
| TB Register | TB program | NOT IN CANONICAL MODEL | REQUIRES PROGRAM + SPEC |
| Minor Theatre | theatre bookings | operational theatre report only | INTERNAL REGISTER ONLY |
| Occupational Therapy | clinic encounters | NOT A SEPARATE MODULE | REQUIRES BUSINESS DECISION |
| Physiotherapy | clinic (Physio fee exists) | clinic operational, no MOH form | REQUIRES OFFICIAL MOH SPEC |

## Cards

MOH201, 216, 257, 258, 268, HEI Card, ICF/IPT Card: **REQUIRES OFFICIAL MOH SPEC**. Do not invent card field layouts.

## Tally sheets

MOH701A, 701B, 702, 704: **REQUIRES OFFICIAL MOH SPEC**.

## Summary sheets

| Tool | Status |
| --- | --- |
| MOH717 | IMPLEMENTED as internal projection |
| MOH710 | NOT IMPLEMENTED |
| MOH705A / 705B | IMPLEMENTED as internal projection |
| MOH713 / 515 / 105 / 718 / 731 / 364 | NOT IMPLEMENTED — REQUIRES OFFICIAL MOH SPEC |
| Malaria commodities, MOH504, 505, 706, 711, SDP, 713 HIV nutrition, 734, 643, KMMP | 706 lab summary exists; others require official commodity/HIV specs |

## HRI / 107A / 107B

No authoritative HRI specification is in the repo. Classification: **REQUIRES OFFICIAL MOH/HRI SPECIFICATION**. Do not invent class or field names.

## Rule for later work

Add `ReportDefinition` / `ReportMapping` only as a mapping layer over existing clinical tables. Generate, validate, export, print, archive. Do not auto-submit to government unless the facility confirms the official channel.
