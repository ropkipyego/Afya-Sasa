#!/usr/bin/env python3
"""Generate the single-file departmental readiness HTML (read-only documentation)."""
from pathlib import Path

OUT = Path(__file__).with_name("AfyaSasa-Departmental-Readiness-Report.html")

html = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>AfyaSasa EMR — Departmental Functionality, Workflow and Readiness Report</title>
<style>
  @page { size: A4; margin: 16mm 14mm 18mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Calibri, Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #1a2332; }
  h1 { font-size: 20pt; margin: 0 0 6pt; color: #0b3d4a; }
  h2 { font-size: 14pt; color: #0b3d4a; border-bottom: 2px solid #0b3d4a; padding-bottom: 4pt; page-break-before: always; margin-top: 0; }
  h2.nobreak { page-break-before: auto; }
  h3 { font-size: 12pt; color: #125c70; margin: 16pt 0 6pt; }
  h4 { font-size: 11pt; margin: 12pt 0 4pt; color: #333; }
  .cover { page-break-after: always; padding-top: 28mm; }
  .muted { color: #5a6570; }
  .tag { display: inline-block; padding: 1pt 7pt; border-radius: 3pt; font-size: 8.5pt; font-weight: 700; letter-spacing: .02em; }
  .ok { background: #d9f2e3; color: #0d5c32; }
  .mid { background: #fff3c4; color: #6b5300; }
  .warn { background: #ffe0c2; color: #8a3b00; }
  .bad { background: #f8d0d0; color: #7a1010; }
  .info { background: #d6eaf8; color: #1a5276; }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0 12pt; font-size: 9.3pt; }
  th, td { border: 1px solid #c5ced6; padding: 4pt 6pt; vertical-align: top; text-align: left; }
  th { background: #0b3d4a; color: #fff; font-weight: 600; }
  tr:nth-child(even) td { background: #f4f7f8; }
  .scorebox { display: flex; gap: 8pt; margin: 10pt 0 14pt; }
  .card { flex: 1; border: 1px solid #c5ced6; border-radius: 4pt; padding: 8pt 10pt; background: #f7fbfc; }
  .card b { display: block; font-size: 18pt; color: #0b3d4a; }
  .flow { background: #f0f4f6; border-left: 4px solid #0b3d4a; padding: 8pt 10pt; margin: 8pt 0 12pt; }
  .flow ol { margin: 4pt 0 0 16pt; padding: 0; }
  .flow li { margin: 3pt 0; }
  ul.tight li { margin: 2pt 0; }
  .note { background: #fff8e6; border: 1px solid #e6d39a; padding: 7pt 9pt; margin: 8pt 0; }
  .danger { background: #fdeeee; border: 1px solid #e6b0b0; padding: 7pt 9pt; margin: 8pt 0; }
  .small { font-size: 8.5pt; color: #5a6570; }
  code { font-family: Consolas, "Courier New", monospace; font-size: 8.8pt; background: #eef2f4; padding: 0 3pt; }
  .toc a { color: #0b3d4a; text-decoration: none; }
  .bar { height: 10pt; background: #e4eaee; border-radius: 6pt; overflow: hidden; margin: 3pt 0 8pt; }
  .bar > span { display: block; height: 100%; background: #1a7a62; }
  footer { position: running(footer); }
</style>
</head>
<body>

<div class="cover">
  <p class="muted">Jalaram Hospital · AfyaSasa Clinical EMR · Confidential operational audit</p>
  <h1>AfyaSasa EMR</h1>
  <p style="font-size:16pt;margin:0 0 18pt">Departmental functionality, workflows, gaps and readiness</p>
  <p><strong>Single combined report</strong> for hospital management and engineering.<br>
  Audit date: 15 October 2026 (Africa/Nairobi)<br>
  Source inspected: git <code>507cc02</code> on branch <code>main</code><br>
  Nature: <strong>read-only inspection and documentation</strong>. No application, database, configuration, or production change.</p>
  <div class="scorebox">
    <div class="card"><span class="tag mid">CODE IMPLEMENTATION</span><b>70%</b>Weighted score of 102 features in source (see method).</div>
    <div class="card"><span class="tag warn">VERIFIED THIS AUDIT</span><b>0%</b>No logged-in clinical workflow was exercised.</div>
    <div class="card"><span class="tag info">PRODUCTION VERSION</span><b>Unknown</b>Contabo / live hospital image SHA was not inspected.</div>
  </div>
  <div class="note"><strong>How to read the percentages.</strong> 70% means: most departmental screens and APIs exist in the current source code, with automated tests from 14 October 2026, but this audit did <em>not</em> sit with staff and complete live visits. It is <strong>not</strong> “the hospital is 70% live” and it is <strong>not</strong> “production is 70% on this commit”. Staff have separately reported that OPD is efficient and prescriptions generally work, with some dispensing issues still to investigate.</div>
  <p class="small">No patient names, identifiers, credentials, or secrets appear in this document.</p>
</div>

<h2 class="nobreak">Contents</h2>
<ol class="toc">
  <li>How this report was built, and what the percentages mean</li>
  <li>Hospital-wide readiness dashboard</li>
  <li>What the system is (architecture and baseline)</li>
  <li>Hospital journey in one picture</li>
  <li>Module by module (what it is, what works, the flow, gaps, score)</li>
  <li>Pharmacy and OPD deep investigation</li>
  <li>Money words: charge vs payment vs receipt vs QuickBooks</li>
  <li>Integrations (SHA, FHIR, M-Pesa, email, SMS)</li>
  <li>Issues register and recommended next work</li>
  <li>Tests, evidence, and what was not done</li>
</ol>

<h2>1. How this report was built, and what the percentages mean</h2>
<h3>1.1 Purpose</h3>
<p>This is one document that answers, for every hospital department in AfyaSasa: <strong>what the module is</strong>, <strong>who uses it</strong>, <strong>the actual staff flow as coded</strong>, <strong>what is working in the software</strong>, <strong>what is incomplete or unverified</strong>, and <strong>a readiness percentage with a defined method</strong>.</p>
<p>It consolidates the departmental audit of 15 October 2026. It does not invent a workflow because a menu item exists. A button is not proof that the downstream stock, bill, or result was saved.</p>

<h3>1.2 Evidence rules</h3>
<table>
  <tr><th>Claim</th><th>Allowed evidence</th></tr>
  <tr><td>Exists in software</td><td>Exact screen, file, API path, database table in source <code>507cc02</code></td></tr>
  <tr><td>Has automated tests</td><td>Named Jest spec + dated log of 14 Oct 2026 (380 passed). Tests were not re-run on 15 Oct.</td></tr>
  <tr><td>Running locally</td><td>Docker containers healthy; <code>GET /api/v1/health</code> returned ok. Images were built <strong>before</strong> commit 507cc02.</td></tr>
  <tr><td>Used in the hospital</td><td>Staff report only, labelled as such. No patient file was opened.</td></tr>
  <tr><td>Works in production</td><td><strong>Not claimed.</strong> Production host and version were not inspected.</td></tr>
</table>

<h3>1.3 Scoring method (denominator = 102 features)</h3>
<p>A <strong>feature</strong> is one staff capability with a named screen and/or API (matrix F01–F92 and S01–S10). That is the denominator. Percentages are not guessed.</p>
<table>
  <tr><th>Status</th><th>Meaning</th><th>Points</th><th>Count</th></tr>
  <tr><td>Verified operational</td><td>This audit exercised the live workflow</td><td>100</td><td>0</td></tr>
  <tr><td>Implemented, partially verified</td><td>Code + tests and/or staff report; no live UAT this audit</td><td>75</td><td>88</td></tr>
  <tr><td>Partially implemented</td><td>Essential step missing (device, live HIE, unapplied SQL, mapping-only)</td><td>40</td><td>10</td></tr>
  <tr><td>Configured but unverified</td><td>Settings exist; live delivery not proven</td><td>45</td><td>1</td></tr>
  <tr><td>Unverified</td><td>Screen exists; this audit did not inspect behaviour</td><td>35</td><td>1</td></tr>
  <tr><td>Blocked or defective</td><td>Policy or reproducible block prevents the step</td><td>15</td><td>1</td></tr>
  <tr><td>Not implemented</td><td>Confirmed absent</td><td>0</td><td>1</td></tr>
</table>
<p><strong>Hospital code-implementation score</strong> = (88×75 + 10×40 + 1×45 + 1×35 + 1×15 + 1×0) / (102×100) = <strong>7,095 / 10,200 = 69.6%, reported as 70%</strong>.</p>
<p><strong>Independently verified operational score this audit</strong> = 0 / 102 = <strong>0%</strong>. That is honest: nobody completed a visit, dispense, or payment under auditor observation on 15 October.</p>
<p>Module scores use the same points, only on that module’s features. They are comparable to each other. They are <strong>not</strong> “this ward is 75% clinically safe”.</p>

<h3>1.4 Three percentages you must not mix</h3>
<ol>
  <li><strong>70% code implementation</strong> — source at 507cc02 has most departmental functions built.</li>
  <li><strong>0% auditor-verified live</strong> — this audit did not log in as staff.</li>
  <li><strong>Unknown production alignment</strong> — local Docker images pre-date 507cc02; live Contabo version unknown.</li>
</ol>

<h2>2. Hospital-wide readiness dashboard</h2>
<table>
  <tr><th>Module</th><th>Features</th><th>Code score</th><th>Staff-reported live use</th><th>Main gap</th></tr>
  <tr><td>Front office</td><td>10</td><td>72%</td><td>Registration / check-in implied by OPD report</td><td>Biometrics need a device</td></tr>
  <tr><td>OPD</td><td>12</td><td>75%</td><td><strong>Yes — reported efficient</strong></td><td>Not auditor-verified; consult fee not auto-charged</td></tr>
  <tr><td>Pharmacy</td><td>14</td><td>72%</td><td>Prescriptions generally work; <strong>dispensing issues reported</strong></td><td>PH-R1 unreproduced; name-match SKU</td></tr>
  <tr><td>Laboratory</td><td>10</td><td>69%</td><td>Not stated this audit</td><td>Amend blocked; template sign-off</td></tr>
  <tr><td>Radiology</td><td>6</td><td>75%</td><td>Not stated</td><td>No PACS</td></tr>
  <tr><td>IPD / nursing / ICU / HDU</td><td>10</td><td>75%</td><td>Not stated</td><td>Clinical UAT not done</td></tr>
  <tr><td>Emergency / theatre / maternity / blood bank</td><td>9</td><td>67%</td><td>Not stated</td><td>Blood bank absent; specialty UAT</td></tr>
  <tr><td>Finance</td><td>9</td><td>67%</td><td>Not stated</td><td>Live M-Pesa / QB unverified; finance metrics uncertified</td></tr>
  <tr><td>Store / procurement</td><td>6</td><td>63%</td><td>Not stated</td><td>Session/lot SQL unapplied</td></tr>
  <tr><td>Documents / reports / marketing</td><td>6</td><td>58%</td><td>Not stated</td><td>Email, SMS, KHIS, Director pharmacy KPI</td></tr>
  <tr><td>Platform / security / SHA / FHIR</td><td>10</td><td>65%</td><td>Login used in hospital (implied)</td><td>Live HIE not verified</td></tr>
  <tr><td><strong>Hospital (all 102)</strong></td><td><strong>102</strong></td><td><strong>70%</strong></td><td>OPD + Rx yes; dispensing mixed</td><td>See register</td></tr>
</table>
<div class="bar" title="70%"><span style="width:70%"></span></div>
<p class="small">Module arithmetic is in the appendix of this chapter’s scoring notes. OPD 75% is “all twelve features are implemented, partially verified”, not “OPD is three-quarters built”. Staff report OPD is the strongest live pathway.</p>

<h2>3. What the system is</h2>
<h3>3.1 Identity</h3>
<table>
  <tr><th>Item</th><th>Value</th></tr>
  <tr><td>Product</td><td>AfyaSasa Clinical EMR for Jalaram Hospital (tenant code <code>jalaram</code>)</td></tr>
  <tr><td>Repository</td><td>local path Afya-Sasa, branch main</td></tr>
  <tr><td>Commit</td><td><code>507cc02</code> — message “drugs changes....” — 14 Oct 2026 17:25 EAT</td></tr>
  <tr><td>Stack</td><td>React frontend, NestJS backend, PostgreSQL (TypeORM schema still named <code>demo</code>), Redis, MinIO</td></tr>
  <tr><td>API prefix</td><td><code>/api/v1</code></td></tr>
  <tr><td>Auth</td><td>JWT access token + refresh cookie. Global login guard. Permissions on each API (OR of listed keys). Menu hiding is not security.</td></tr>
  <tr><td>Local stack this audit</td><td>Containers healthy. Health JSON ok. Images created 14 Oct 2026 11:39 EAT — <strong>older than the commit</strong>.</td></tr>
</table>
<p>There is <strong>one inventory ledger</strong> for store and pharmacy. There is <strong>one cashier ledger</strong> (charges and payment transactions). QuickBooks is the accounting general ledger, not a second EMR till.</p>

<h3>3.2 Screens staff see (navigation)</h3>
<p>36 labelled screens in 13 groups from <code>frontend/src/lib/navigation.ts</code>. A user only sees groups they have permission for. The API still enforces permission even if someone crafts a request.</p>
<p><strong>Dashboard:</strong> All Queues.<br>
<strong>Front office:</strong> Register Patient, Patient Registry, Identify Patient, OPD Check-In, Appointments.<br>
<strong>OPD:</strong> Triage Queue, Doctor Queue, Sick Sheets, Referrals, Orders.<br>
<strong>IPD:</strong> Inpatient, ICU, HDU, Nursing.<br>
<strong>Diagnostics:</strong> Laboratory, Lab Queue, Radiology, Imaging Queue.<br>
<strong>Specialty:</strong> Emergency, Theatre, Maternity.<br>
<strong>Pharmacy:</strong> Pharmacy, Queue, Dispensing, Sales, Stock, Stock Take, Products, Reports.<br>
<strong>Store:</strong> Inventory &amp; Store.<br>
<strong>Finance:</strong> Cashier / Billing, Insurance &amp; Claims.<br>
<strong>Documents:</strong> Medical Documents, Hospital Library, Reports.<br>
<strong>Marketing.</strong> <strong>Director Dashboard.</strong> <strong>Control Center</strong> and Interoperability.</p>
<p><strong>Not in the menu:</strong> blood bank (does not exist), HR/payroll, a separate e-invoice document type.</p>

<h2>4. Hospital journey in one picture</h2>
<div class="flow">
<ol>
  <li><strong>Front office</strong> searches. If no file, registers the person (duplicate check on identifiers). Then OPD check-in creates today’s visit, or a diagnostic-only visit that goes to lab/radiology instead of a doctor.</li>
  <li><strong>Nurse</strong> triages (vitals). <strong>Doctor</strong> sees own queue, writes SOAP, diagnosis, lab/rad orders, prescription. Completes the encounter.</li>
  <li><strong>Laboratory / radiology</strong> collect or image, enter results, a verifier publishes. Clinician inbox shows verified work.</li>
  <li><strong>Pharmacy</strong> sees the prescription as requested. Stock does <em>not</em> move until the pharmacist confirms. Then FEFO lots decrease and a pharmacy <em>charge</em> is written in the same database transaction. Cash is a later cashier step.</li>
  <li>If the patient is admitted, <strong>IPD</strong> occupies a bed. Nursing records vitals and MAR (MAR is not a stock deduction). Discharge needs a summary. Theatre, maternity, ICU, HDU, emergency are separate workspaces that still depend on the same lab/pharmacy/cashier where orders exist.</li>
  <li><strong>Cashier</strong> sees charges (owed), takes payment (cash/card/insurance/M-Pesa as configured), reprints a receipt. QuickBooks is supposed to receive accounting later — not verified live.</li>
  <li><strong>Director</strong> sees counts from the same tables. Finance tiles are not a certified P&amp;L. Pharmacy activity on the director screen is explicitly “data unavailable”.</li>
</ol>
</div>
<p>If any of those hops is skipped in real life (for example cashier posts a consult fee that check-in never created, or pharmacy cannot match a drug name), the software still has a path — that is where operational pain appears.</p>

<h2>5. Module by module</h2>

<h3>5.1 Front office and patient registration — code score 72%</h3>
<p><span class="tag ok">IMPLEMENTED IN SOURCE</span> <span class="tag mid">NOT LIVE-UAT THIS AUDIT</span></p>
<p><strong>What this module is.</strong> The hospital’s front door: find a person, create a file if needed, check them into today’s service, book appointments, optionally identify by fingerprint if a DigitalPersona device is attached.</p>
<p><strong>Who.</strong> Records officers / reception. Permission keys include <code>patients:create</code>, <code>patients:search</code>, <code>patients:read</code>, <code>encounters:create</code>, <code>appointments:read</code>.</p>
<p><strong>Screens.</strong> Register Patient, Patient Registry, Identify Patient, OPD Check-In, Appointments. Header global search.</p>
<p><strong>What it is not.</strong> It does not by itself collect money. Check-in shows the clinic consultation fee on screen; it does <strong>not</strong> insert a row into <code>charges</code>. It is not SHA eligibility (that is a separate SHA call). Name-only similarity is not treated as a duplicate; unique identifiers are.</p>
<div class="flow">
<strong>Actual flow (as coded)</strong>
<ol>
  <li>Staff search <code>GET /api/v1/patients</code>. If found, open the file. Do not create a second person.</li>
  <li>If new: <code>POST /patients/duplicates</code> then <code>POST /patients</code>. Identifiers, next of kin, allergies, chronic conditions can be added on the patient.</li>
  <li>OPD Check-In: choose patient, clinic, visit type, optional doctor, complaint. <code>POST /opd/encounters</code>.</li>
  <li>If the patient already has an open OPD visit today (Nairobi day), the API refuses a second one — continue the existing visit.</li>
  <li>Visit type routes the queue token: <code>new</code> / <code>follow_up</code> / <code>referral</code> → doctor (OPD queue). <code>laboratory_only</code> or <code>diagnostic</code> → laboratory queue. <code>radiology_only</code> → radiology queue.</li>
  <li>Appointments: slots, bookings, status, mark arrived (<code>/appointments</code>). Hospital-wide “today” list is not automatically doctor-scoped (the doctor screen has a separate “my appointments today”).</li>
</ol>
</div>
<p><strong>What is working in the software.</strong> Search, register, identifier uniqueness, check-in with visit types, open-visit guard, appointment APIs, patient history/timeline/chart/QR card endpoints. Automated tests exist on patient duplicates and OPD encounter create (prior 14 Oct).</p>
<p><strong>Gaps.</strong> Identify Patient depends on biometric hardware and agent — scored partial (40 points). No auditor login. Production unknown.</p>
<p><strong>Readiness.</strong> 9 features × 75 + biometrics 40 = 715 / 1,000 = <strong>72%</strong>.</p>

<h3>5.2 Outpatient department (OPD) — code score 75%</h3>
<p><span class="tag ok">STRONGEST STAFF-REPORTED MODULE</span> <span class="tag mid">CODE COMPLETE FOR CORE PATH</span></p>
<p><strong>What this module is.</strong> The clinic visit: nurse triage, doctor consultation, diagnosis, orders, completion, sick sheets, referrals, follow-up.</p>
<p><strong>Who.</strong> Nurses (<code>triage:create</code>), doctors (<code>consultations:create</code>, <code>diagnoses:create</code>, <code>pharmacy:prescribe</code>), clerks for sick sheets/referrals.</p>
<p><strong>Screens.</strong> Triage Queue, Doctor Queue, Sick Sheets, Referrals, Orders. Doctors also prescribe from the consultation workspace, not from the pharmacy menu.</p>
<p><strong>What it is not.</strong> It is not the emergency module (ED uses <code>emergency_encounters</code>). It is not automatic billing of the consult fee. Completing a visit does not dispense drugs.</p>
<div class="flow">
<strong>Actual flow (as coded)</strong>
<ol>
  <li>Encounter exists in status registered (from check-in). Queue type OPD unless diagnostic routing applied.</li>
  <li>Nurse opens Triage Queue, records vitals/category via <code>POST /opd/encounters/:id/triage</code>.</li>
  <li>Doctor opens Doctor Queue: <code>GET /opd/doctor/queue</code> — own assigned patients plus unassigned. Supervisors see all. Plus <code>GET /opd/doctor/appointments/today</code>.</li>
  <li>Consultation: SOAP <code>POST .../consultations</code>. Diagnoses (ICD text in EMR; no live ICD-10 web service). Notes and file attachments.</li>
  <li>Orders: laboratory request and/or radiology request and/or multi-line prescription <code>POST /clinical-orders/pharmacy/prescription</code>. Prescription status becomes <em>requested</em>. Stock is untouched.</li>
  <li>Optional follow-up date. Complete visit <code>PATCH .../status</code> through the encounter workflow service (illegal status jumps are rejected).</li>
  <li>Sick sheet and referral workspaces are separate documents/letters, not a substitute for the consultation note.</li>
</ol>
</div>
<p><strong>What is working.</strong> Staff report the pathway is efficient. Source implements the full chain above. Queue scoping is unit-tested. Prescription grouping is unit-tested.</p>
<p><strong>Gaps.</strong> This audit did not watch a doctor complete a visit. Diagnostic-only patients can still receive a consult charge later if cashier adds one. Follow-up SMS is not evidenced as live.</p>
<p><strong>Readiness.</strong> 12/12 implemented, partially verified = <strong>75%</strong>. Combined with staff report, this is the module management can treat as the operational backbone — still not 100% auditor-verified.</p>

<h3>5.3 Pharmacy and drug dispensing — code score 72%</h3>
<p><span class="tag warn">PRIORITY MODULE</span> <span class="tag mid">PRESCRIBE REPORTED OK</span> <span class="tag bad">DISPENSE ISSUES REPORTED, NOT REPRODUCED</span></p>
<p><strong>What this module is.</strong> The place medicines leave the shelf. It uses the <strong>same</strong> stock tables as the store. Location code <code>PHARMACY</code>. Confirming a prescription writes a <code>DISPENSE</code> ledger line and, if priced, a <code>charges</code> row in the <strong>same database transaction</strong>. Payment is still cashier.</p>
<p><strong>Who.</strong> Pharmacists (<code>pharmacy:read</code>, <code>pharmacy:dispense</code>). Doctors prescribe; they should not confirm stock.</p>
<p><strong>Screens.</strong> Pharmacy home, Queue, Dispensing, Sales, Stock, Stock Take, Products, Reports. OTC panel for walk-in sales.</p>
<p><strong>What it is not.</strong> Nursing MAR is not dispensing. Director “pharmacy activity” is not this module (that KPI is unavailable). Store requisition is how bulk stock arrives at PHARMACY, not how a patient is served.</p>
<div class="flow">
<strong>Actual flow (as coded)</strong>
<ol>
  <li>Doctor already created a prescription header + lines (<code>clinical_orders</code>, status requested, qty dispensed 0).</li>
  <li>Pharmacist loads queue <code>GET /clinical-orders</code> (pharmacy module). UI groups lines by prescription group.</li>
  <li>UI matches each line to a catalogue item: prefers <code>metadata.itemId</code>; if missing, <strong>normalised name equality</strong>. That heuristic can pick the wrong SKU if two products share a name and itemId was not stored.</li>
  <li>Pharmacist reviews quantities and ticks confirm. API <code>POST /inventory/dispense/prescription</code> with <code>confirm: true</code>. Without confirm, API rejects.</li>
  <li>Backend locks the order row, allocates non-expired FEFO batches, reduces <code>qtyOnHand</code>, writes <code>inventory_transactions</code> type DISPENSE, upserts pharmacy charge using a <code>dispenseOpId</code> so the same operation should not double-bill if retried correctly.</li>
  <li>If stock is short, expired, cancelled, or already fully dispensed — error, no silent partial without remaining-qty rules. Partial dispense is supported via remaining quantity metadata.</li>
  <li>If charge insert fails, the whole transaction rolls back — staff see an error; stock should remain. Billing retry exists without moving stock again: <code>POST /inventory/dispense/retry-billing/:orderId</code>.</li>
  <li>Patient is told to pay at cashier. History filters show dispensed / partial.</li>
</ol>
</div>
<p><strong>OTC.</strong> <code>POST /inventory/dispense/otc</code>. Frontend sends a random <code>saleId</code> per submit (idempotent for that click). Walk-in without patient is unbilled by design. Without saleId the API would mint a new id each call (not idempotent).</p>
<p><strong>What is working in software.</strong> Confirm gate, FEFO, same-txn charge, order lock, insufficient-stock errors, cancelled-Rx refusal, stock-take workspace, catalogue, low/expiry views. Strong unit tests and 12 disposable-Postgres concurrency tests on 14 Oct (miniature schema, not hospital data).</p>
<p><strong>What staff reported.</strong> Prescriptions generally work. A few dispensing problems remain. This audit <strong>did not dispense</strong> and therefore <strong>confirmed zero dispensing bugs</strong>. The report is an open P1 until someone captures the exact error (wrong drug, no stock movement, double charge, timeout, permission).</p>
<p><strong>Likely technical suspects (not proven incidents):</strong> name-match SKU; running Docker images older than the stock-integrity commit; concurrent stock-take without the planned unique session table.</p>
<p><strong>Readiness.</strong> 13×75 + sales-view 35 = 1,010 / 1,400 = <strong>72%</strong>. Do not read this as “dispensing is 72% reliable in the cubicle”.</p>

<h3>5.4 Laboratory — code score 69%</h3>
<p><strong>What it is.</strong> Test catalogue, requests from OPD/IPD, sample + barcode, receive/reject, result entry with flags, verification by a different permission, reports, clinician inbox, critical results.</p>
<p><strong>Who.</strong> Lab technicians enter; lab verifiers verify (<code>lab_results:verify</code>). Cancel needs <code>lab_requests:cancel</code> — not on the technician template. Doctors create requests.</p>
<div class="flow">
<ol>
  <li>Request <code>POST /laboratory/requests</code> (status requested).</li>
  <li>Collect sample, barcode generate/scan, receive or reject.</li>
  <li>Enter results (panel or item). Missing reference ranges → flag “unassessed”, not a fake normal.</li>
  <li>Verifier <code>POST /laboratory/requests/:id/verify</code>.</li>
  <li>Report PDF/layouts. Clinician inbox / critical list.</li>
  <li>Amend of a verified result exists in code but is <strong>switched off</strong> (<code>AFYASASA_LAB_AMENDMENT_ENABLED=false</code> on compose). That is policy, scored as blocked (15 points), not a random crash.</li>
</ol>
</div>
<p><strong>Gaps.</strong> Lab report templates still need clinical sign-off. Isolated lab Postgres tests (10 passed 14 Oct) used a toy schema. No live sample was processed this audit.</p>
<p><strong>Readiness.</strong> 9×75 + amend 15 = 690 / 1,000 = <strong>69%</strong>.</p>

<h3>5.5 Radiology and imaging — code score 75%</h3>
<p><strong>What it is.</strong> Modalities catalogue, requests, status (requested → scheduled → in_progress), report + verify, file attachments, clinician inbox. Diagnostic-only OPD visits land on the radiology queue.</p>
<p><strong>What it is not.</strong> A PACS / DICOM viewer. Attachments are files in object storage.</p>
<div class="flow">
<ol>
  <li>Create request <code>POST /radiology/requests</code>.</li>
  <li>Move status; perform study; attach files if any.</li>
  <li>Write report; verify. Review endpoint exists for downstream clinicians.</li>
</ol>
</div>
<p><strong>Readiness.</strong> 6×75 = <strong>75%</strong> implementation. Scheduling depth is limited compared with a full RIS. Live imaging UAT not done.</p>

<h3>5.6 Inpatient, nursing, ICU, HDU — code score 75%</h3>
<p><strong>What IPD is.</strong> Wards and beds, admit (bed occupied), ward transfer, progress notes, discharge summary + PDF, discharge that <strong>requires</strong> a summary, cancel admission.</p>
<p><strong>What nursing is.</strong> Vitals, MAR (medication administration record), observations, shift notes. MAR documents that a dose was given. It does <strong>not</strong> reduce pharmacy stock. Inpatient medicines still go through pharmacy confirm if prescribed.</p>
<p><strong>What ICU / HDU are.</strong> Separate modules, wired in the current app (the August 2026 gap note that ICU UI was unwired is stale). ICU: admissions, observations, ventilator, fluids, rounds. HDU: admissions, observations, rounds, status.</p>
<div class="flow">
<ol>
  <li>Admit <code>POST /inpatient/admissions</code> — bed taken.</li>
  <li>Care: notes, nursing, orders to lab/rad/pharmacy as for OPD.</li>
  <li>Optional transfer between wards.</li>
  <li>Accommodation charging is a <em>job</em> using catalogue rates; empty rate means no charge appears.</li>
  <li>Write discharge summary, then discharge. PDF available.</li>
</ol>
</div>
<p><strong>Readiness.</strong> 10×75 = <strong>75%</strong>. Clinical UAT of ICU/HDU/discharge not done this audit.</p>

<h3>5.7 Emergency — coded, UAT unverified (in the 67% specialty group)</h3>
<p><strong>What it is.</strong> ED command center: register, dashboard, queue, bays, alerts, triage, notes, observation, disposition.</p>
<p><strong>What it is not.</strong> An OPD encounter. Tables are <code>emergency_encounters</code>. Disposition to admit/discharge/refer is in the API; walking a real patient from ED into IPD was not observed.</p>
<div class="flow">
<ol>
  <li><code>POST /emergency/register</code> → triage → assign bay → notes/observation → <code>POST /emergency/:id/disposition</code>.</li>
</ol>
</div>

<h3>5.8 Theatre — coded, UAT unverified</h3>
<p>Rooms, procedure catalogue (including import), bookings, status, staff assignment, notes, complications. Consumables are expected via store requisitions, not automatic theatre stock deduction. Tests: theatre service and notes specs (prior 14 Oct).</p>

<h3>5.9 Maternity — coded, UAT unverified</h3>
<p>Pregnancies, ANC visits, labour records, partograph, deliveries, postnatal, newborns, optional <code>register-newborn-patient</code>, mother-baby registry, maternity units. <strong>Risk:</strong> registering a newborn must not duplicate the mother’s patient file. Clinical UAT not done.</p>

<h3>5.10 Blood bank — code score 0% of that feature</h3>
<p><span class="tag bad">NOT IMPLEMENTED</span> No screen, no API, no table. Do not store blood units as pharmacy lots. If transfusion is a live hospital process, it is outside AfyaSasa today. Combined with ED/theatre/maternity this slice scores <strong>67%</strong> because eight specialty features are implemented and blood bank is zero.</p>

<h3>5.11 Billing, payments, finance — code score 67%</h3>
<p><strong>What it is.</strong> The hospital till: catalogue of prices, charges (what is owed), payments (what was collected), refunds, cashier summary and close, exceptions, IPD accommodation job, statement, M-Pesa STK + callback, QuickBooks queue/Web Connector, insurance claim <em>drafts</em>.</p>
<p><strong>What it is not.</strong> An invoice module (no separate invoice table found). Not QuickBooks itself. Not “revenue” on the director screen (collections ≠ revenue ≠ GL).</p>
<div class="flow">
<ol>
  <li>A <strong>charge</strong> appears because pharmacy dispense created it, cashier added a manual/catalogue charge, or accommodation job ran with a priced rate. OPD check-in does not create the consult charge.</li>
  <li>Cashier looks up patient outstanding <code>GET /payments/outstanding</code> and charges.</li>
  <li>Collect: manual payment (cash/card/insurance as posted) or M-Pesa STK. Callback is IP-allowlisted. <strong>Do not test STK on a real phone from this audit.</strong></li>
  <li>Receipt is a reprint of a completed payment, not a third ledger.</li>
  <li>Refund creates a reversing payment row (metadata kind refund). Original payment remains.</li>
  <li>QuickBooks: queue + web connector. Analytics show accounting as pending. Tests reject missing QBWC credentials.</li>
</ol>
</div>
<p><strong>Readiness.</strong> 7×75 + M-Pesa 40 + QuickBooks 40 = 605 / 900 = <strong>67%</strong>. Director finance is not certified for management decisions until Finance completes a period worksheet (billed vs collected vs outstanding vs QB).</p>

<h3>5.12 Procurement, inventory, store — code score 63%</h3>
<p><strong>What it is.</strong> The stock truth: items, batches, locations, ledger. Goods receipt, requisition approve/issue/acknowledge, transfer ship/receive, stock take (posts <em>variance</em>, not “counted quantity as a receipt”), bulk price, import preview/confirm, integrity panel, low-stock alerts, barcode.</p>
<p><strong>What it is not.</strong> A second pharmacy database. Pharmacy PHARMACY location is one location on this ledger. Buying list lives in the inventory UI; a separate Supplier company module was not found as its own controller.</p>
<div class="flow">
<ol>
  <li>Receive goods → RECEIPT on batches.</li>
  <li>Issue from store to pharmacy (requisition) or transfer between locations.</li>
  <li>Usable qty at PHARMACY is what dispensing can allocate (FEFO, not expired).</li>
  <li>Stock take: import count sheet, preview, confirm. Concurrent posts currently rely on advisory locks; a durable unique session table is <strong>planned SQL, not applied</strong>.</li>
</ol>
</div>
<p><strong>Readiness.</strong> 4×75 + two unapplied SQL features ×40 = 380 / 600 = <strong>63%</strong>.</p>

<h3>5.13 Documents, reports, marketing — code score 58%</h3>
<p>Medical documents linked to the patient, hospital library (policies/forms), reports hub (OPD summary, admissions, discharges, occupancy, emergency stats, disease register, department revenue, MOH 705/706/717 mapping and docx, lab/theatre/maternity/referral/ICU report endpoints), marketing outreach log.</p>
<p><strong>Email</strong> of reports and password reset: admin email settings exist; 14 Oct tests showed mail not configured / allowlist / degraded. Scored configured-but-unverified (45). <strong>SMS bulk</strong> exists — do not treat as live patient SMS (40). <strong>MOH/KHIS submit</strong> is mapping, not a live ministry post (40). Director pharmacy KPI is missing inside analytics (the analytics feature is still 75 because the rest of the dashboard is built).</p>
<p><strong>Readiness.</strong> 3×75 + 40 + 45 + 40 = 350 / 600 = <strong>58%</strong> — lowest departmental slice because delivery and government submit are incomplete.</p>

<h3>5.14 Director dashboard — inside reports, finance not certified</h3>
<p>Screen: Director Dashboard → <code>GET /reports/executive-analytics</code>. Definitions live in <code>docs/AFYASASA_DASHBOARD_METRIC_DEFINITIONS.md</code>.</p>
<table>
  <tr><th>Number on screen</th><th>What it actually is</th><th>Use for decisions?</th></tr>
  <tr><td>OPD visits</td><td>Count of OPD encounters in the date range</td><td>Directional if check-in is reliable</td></tr>
  <tr><td>New patients</td><td>Registrations, not visits</td><td>Do not confuse with attendance</td></tr>
  <tr><td>ED / admissions / discharges / occupancy</td><td>From ED table, admissions, beds</td><td>Occupancy unavailable if zero beds mastered</td></tr>
  <tr><td>Lab/rad pending</td><td>Point-in-time worklist</td><td>Backlog, not quality</td></tr>
  <tr><td>Lab TAT</td><td>Average hours among verified only</td><td>Blank if nothing verified</td></tr>
  <tr><td>Pharmacy activity</td><td><strong>Data unavailable</strong></td><td>Do not invent from stock movements</td></tr>
  <tr><td>Billed / collected / refunds / outstanding</td><td>Charges vs payments vs point-in-time owed</td><td><strong>Not certified; not GL</strong></td></tr>
  <tr><td>Accounting</td><td>Pending QuickBooks</td><td>Do not call EMR cash “deposits”</td></tr>
</table>
<p>Finance tiles hide unless director/admin/superadmin or payments/settings permission. Doctor fixtures received 403 in tests — by design.</p>

<h3>5.15 Users, roles, audit, control center — platform score 65% with SHA/FHIR</h3>
<p>Login, refresh, logout, forgot/reset password, MFA endpoints, session policy. Admin: users (create, patch, activate, deactivate, unlock, reset password, assign roles and departments), roles, permissions, templates, clinics, departments, settings, system health, backups list (restore endpoint exists — do not invoke casually), audit logs export/import, PHI access report.</p>
<p>Permission model is <strong>OR</strong>: any listed key grants the route. Menu hide is cosmetic. Audit interceptor records HTTP mutations; it is not a full old-value/new-value clinical snapshot of every column.</p>
<p>SHA: status, eligibility post, coverage read — local mapping, not a live SHA portal. FHIR: map patient/encounter, synthetic validate — not a FHIR server. Insurance: payers and claim drafts; portal claims stay on sha.go.ke per product copy.</p>
<p><strong>Readiness.</strong> 7×75 + SHA 40 + FHIR 40 + shared-report delivery 40 = 645 / 1,000 = <strong>65%</strong>.</p>

<h2>6. OPD and pharmacy — the special investigation</h2>
<p>Management observation given to this audit: OPD efficient; prescriptions generally fine; dispensing has had a few issues. Treated as <strong>user report</strong>, not a passed test programme.</p>
<table>
  <tr><th>Hop</th><th>Record</th><th>Expected</th><th>Coded behaviour</th></tr>
  <tr><td>Register / check-in</td><td>patients, encounters</td><td>One open OPD visit per day</td><td>Yes; diagnostic types skip doctor</td></tr>
  <tr><td>Consult</td><td>consultations, diagnoses</td><td>SOAP + optional ICD</td><td>Yes</td></tr>
  <tr><td>Prescribe</td><td>clinical_orders</td><td>requested, stock unchanged</td><td>Yes</td></tr>
  <tr><td>Queue</td><td>same orders</td><td>Pharmacist sees lines</td><td>Yes</td></tr>
  <tr><td>Match drug</td><td>UI</td><td>Correct SKU</td><td>itemId else name — risk</td></tr>
  <tr><td>Confirm</td><td>batches + ledger + charge</td><td>One atomic write</td><td>Yes if confirm true and stock exists</td></tr>
  <tr><td>Pay</td><td>payment_transactions</td><td>Later, cashier</td><td>Yes, separate</td></tr>
</table>
<p><strong>Independently confirmed dispensing defects:</strong> none (no live Rx touched).</p>
<p><strong>Open register:</strong> PH-R1 reported P1; PH-S1 name match; PH-S2 charge uniqueness at app layer; PH-S3 unapplied SQL; PH-S4 image lag vs commit.</p>
<p>Next diagnostic (when authorised): one synthetic prescription, capture API error body, remaining qty, batch qty, ledger, charge. Do not use a live patient if avoidable. Do not rewrite OPD or FEFO while investigating.</p>

<h2>7. Money words (do not mix these)</h2>
<table>
  <tr><th>Word</th><th>Table</th><th>Meaning</th></tr>
  <tr><td>Charge</td><td><code>demo.charges</code></td><td>Amount owed. Not cash.</td></tr>
  <tr><td>Payment</td><td><code>demo.payment_transactions</code></td><td>Collection or refund.</td></tr>
  <tr><td>Receipt</td><td>Print of a payment</td><td>Not a fourth ledger.</td></tr>
  <tr><td>Invoice</td><td>Not found as its own entity</td><td>Do not assume e-invoicing.</td></tr>
  <tr><td>General ledger</td><td>QuickBooks</td><td>EMR is the operational till.</td></tr>
</table>
<p>Outstanding on a patient is owed − paid − waived at <em>query time</em>. It is not “this month billed minus this month collected”. Mixing those is how management reports go wrong.</p>

<h2>8. Integrations — maturity, not slogans</h2>
<p>Scale: 1 absent · 2 documented · 3 coded locally · 4 automated tests · 5 sandbox proven · 6 production config seen · 7 live end-to-end proven. This audit never claimed 5–7 for any row. Credentials are not printed here.</p>
<table>
  <tr><th>Integration</th><th>Level</th><th>What exists</th><th>What does not</th></tr>
  <tr><td>SHA / DHA</td><td>3</td><td><code>/sha/status</code>, eligibility, coverage</td><td>Live cover decision unverified</td></tr>
  <tr><td>FHIR</td><td>3</td><td>Map patient/encounter</td><td>Not a FHIR server; sandbox disconnected until official credentials</td></tr>
  <tr><td>Insurance drafts</td><td>3</td><td>Payers, claim drafts</td><td>Portal submission</td></tr>
  <tr><td>M-Pesa</td><td>3–4</td><td>STK + callback + specs</td><td>Live STK</td></tr>
  <tr><td>QuickBooks</td><td>3–4</td><td>Queue, QBWC</td><td>Live connected books</td></tr>
  <tr><td>Email</td><td>3 + unverified</td><td>Admin UI, mail service</td><td>Proven delivery of PHI reports</td></tr>
  <tr><td>SMS</td><td>3 partial</td><td>Bulk + logs</td><td>Live patient SMS programme</td></tr>
  <tr><td>Biometrics</td><td>3 partial</td><td>Identify workspace</td><td>Without DigitalPersona agent</td></tr>
  <tr><td>MinIO files</td><td>3</td><td>Local container healthy</td><td>—</td></tr>
  <tr><td>PACS</td><td>1</td><td>—</td><td>No DICOM archive</td></tr>
  <tr><td>Blood bank LIS</td><td>1</td><td>—</td><td>Entire module</td></tr>
  <tr><td>KHIS</td><td>2–3</td><td>MOH form mapping / docx</td><td>Ministry submit</td></tr>
</table>

<h2>9. Issues and next work (no fixes in this audit)</h2>
<table>
  <tr><th>ID</th><th>Type</th><th>Severity</th><th>Plain language</th></tr>
  <tr><td>PH-R1</td><td>Reported, unreproduced</td><td>P1</td><td>Pharmacists have had dispensing problems. Cause unknown until captured.</td></tr>
  <tr><td>PH-S1</td><td>Suspected</td><td>P1 suspected</td><td>Matching drugs by name can pick the wrong product.</td></tr>
  <tr><td>PH-S4</td><td>Operations</td><td>P1 local</td><td>Running local images may not include the 14 Oct stock-integrity commit.</td></tr>
  <tr><td>PH-S2 / S3</td><td>Suspected</td><td>P2</td><td>Charge uniqueness and unique lot/session SQL are application-level / unapplied.</td></tr>
  <tr><td>LAB amend</td><td>Policy block</td><td>P2</td><td>Verified results cannot be amended while the flag is false — usually correct.</td></tr>
  <tr><td>Finance certify</td><td>Process</td><td>P2</td><td>Do not steer the hospital on uncertified billed/collected tiles.</td></tr>
  <tr><td>SHA / M-Pesa / QB / mail</td><td>Unverified live</td><td>P2</td><td>Coded; not proven in production by this audit.</td></tr>
  <tr><td>Blood bank / PACS / pharmacy KPI</td><td>Missing</td><td>P3</td><td>Not required to keep OPD running; do not fake them.</td></tr>
</table>
<p><strong>No P0</strong> was assigned: no proven wrong-drug event, no proven duplicate cash, no proven break-in, no proven stock corruption during this read-only audit. If PH-R1 turns out to be wrong medication issued, that becomes P0 immediately.</p>
<p><strong>Preserve</strong> OPD, prescribe, FEFO allocate, payment posting. Next authorised phases: (A) synthetic dispense diagnosis, (B) align local images when IT agrees, (C) read-only duplicate-lot snapshot before any unique index, (D) finance worksheet, (E) lab template sign-off, (F) sandbox integrations only.</p>

<h2>10. Tests, evidence, limitations</h2>
<h3>10.1 Tests (14 Oct 2026 17:20 EAT — not re-run 15 Oct)</h3>
<p>Log: <code>docs/release/2026-10-14-test-evidence.log</code>. Tree was dirty on parent <code>a75c2e4</code>, then committed as <code>507cc02</code>.</p>
<ul class="tight">
  <li>Disposable Postgres inventory concurrency: 12 passed.</li>
  <li>Disposable Postgres laboratory: 10 passed.</li>
  <li>Full backend Jest: 71 suites, <strong>380 passed, 0 failed</strong>.</li>
  <li>Frontend and backend TypeScript compile: exit 0.</li>
  <li>Mail during tests: not configured / allowlist / degraded then a mock accept. QBWC: credentials missing rejected. Auth: 401 without token; 403 doctor on director analytics.</li>
</ul>
<p>Those tests prove code behaviour in isolation. They do not prove the live pharmacy window at Jalaram.</p>

<h3>10.2 What this work did not do</h3>
<ul class="tight">
  <li>No production access, no migrations, no seeds, no container restarts, no deploys, no commits, no patient data, no real payments, SMS, email, or SHA calls.</li>
  <li>No logged-in click-through of any department on 15 October.</li>
  <li>Did not claim local Docker equals production.</li>
</ul>

<h3>10.3 Main APIs (all under /api/v1)</h3>
<p><code>auth</code>, <code>admin</code>, <code>admin/email</code>, <code>patients</code>, <code>opd</code>, <code>appointments</code>, <code>inpatient</code>, <code>emergency</code>, <code>nursing</code>, <code>icu</code>, <code>hdu</code>, <code>laboratory</code>, <code>laboratory/catalog</code>, <code>radiology</code>, <code>theatre</code>, <code>maternity</code>, <code>clinical-orders</code>, <code>inventory</code>, <code>payments/*</code>, <code>reports</code>, <code>exports</code>, <code>documents</code>, <code>storage</code>, <code>referrals</code>, <code>queue</code>, <code>marketing</code>, <code>notifications</code>, <code>biometrics</code>, <code>sha</code>, <code>integrations/fhir</code>, <code>insurance</code>, <code>health</code>.</p>

<h3>10.4 Bottom line for the Director</h3>
<div class="note">
<p><strong>AfyaSasa already covers the departments a hospital runs day to day</strong> — registration, OPD, diagnostics, wards, theatre, maternity, pharmacy, store, cashier, reports, admin — in source code, with a large automated test suite from 14 October 2026.</p>
<p><strong>Treat OPD as the live clinical spine</strong> based on staff report, not based on a new auditor sit-in.</p>
<p><strong>Treat pharmacy dispensing as the open operational risk</strong> until one captured failure (or a clean synthetic success) explains the staff complaints.</p>
<p><strong>Treat director finance numbers as operational, not audited accounts.</strong> QuickBooks remains the books.</p>
<p><strong>Hospital code-implementation readiness: 70%.</strong> Auditor-verified live readiness this audit: 0%. Production version: unknown. Those three sentences are the accurate summary; anything smoother would be marketing, not an audit.</p>
</div>
<p class="small">Supporting markdown pack (same findings, split files): docs/audits/afyasasa-departmental-audit/README.md and 01–09. This PDF is the single combined narrative requested for management.</p>
</body>
</html>
"""

OUT.write_text(html, encoding="utf-8")
print(f"wrote {OUT} bytes={OUT.stat().st_size}")
