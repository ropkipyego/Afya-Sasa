#!/usr/bin/env python3
from pathlib import Path

OUT = Path(__file__).with_name("AfyaSasa-Hospital-Leadership-Report.html")

html = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>AfyaSasa — Simple hospital report for leadership</title>
<style>
  @page { size: A4; margin: 16mm 15mm 18mm 15mm; }
  body { font-family: Georgia, "Times New Roman", serif; font-size: 12pt; line-height: 1.5; color: #222; }
  h1 { font-family: "Segoe UI", Arial, sans-serif; font-size: 22pt; color: #0b3d4a; margin: 0 0 8pt; }
  h2 { font-family: "Segoe UI", Arial, sans-serif; font-size: 15pt; color: #0b3d4a; border-bottom: 2px solid #0b3d4a; padding-bottom: 4pt; page-break-before: always; margin-top: 0; }
  h2.first { page-break-before: auto; }
  h3 { font-family: "Segoe UI", Arial, sans-serif; font-size: 12.5pt; color: #0b3d4a; margin: 16pt 0 6pt; }
  p { margin: 0 0 9pt; }
  .cover { page-break-after: always; padding-top: 22mm; }
  .muted { color: #555; font-size: 11pt; }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0 14pt; font-size: 10.5pt; font-family: "Segoe UI", Arial, sans-serif; }
  th, td { border: 1px solid #bbb; padding: 6pt 8pt; vertical-align: top; text-align: left; }
  th { background: #0b3d4a; color: #fff; }
  tr:nth-child(even) td { background: #f6f8f9; }
  .green { background: #c8e6c9; color: #1b5e20; font-weight: 700; padding: 1pt 6pt; }
  .amber { background: #ffe082; color: #e65100; font-weight: 700; padding: 1pt 6pt; }
  .red { background: #ffcdd2; color: #b71c1c; font-weight: 700; padding: 1pt 6pt; }
  .box { border: 1px solid #ccc; padding: 10pt 12pt; margin: 10pt 0 14pt; background: #f7fafb; }
  .story { background: #eef6f4; border-left: 5px solid #1a7a62; padding: 10pt 12pt; margin: 10pt 0 14pt; }
  .warn { background: #fff8e1; border-left: 5px solid #f9a825; padding: 10pt 12pt; margin: 10pt 0 14pt; }
  ol, ul { margin: 4pt 0 12pt 18pt; }
  li { margin: 4pt 0; }
  .big { font-size: 28pt; font-weight: 700; color: #0b3d4a; font-family: "Segoe UI", Arial, sans-serif; }
  .dept { page-break-inside: avoid; }
</style>
</head>
<body>

<div class="cover">
  <p class="muted">Jalaram Hospital · For the Director and department heads · 15 October 2026</p>
  <h1>AfyaSasa hospital system</h1>
  <p style="font-size:16pt;margin-bottom:16pt">A plain-language report: what each department does on the computer, how a patient moves, what is working, and what still needs attention.</p>
  <p>This paper is written for someone who <strong>runs a hospital, not a computer company</strong>. There are no technical codes here. If you can follow a patient from the gate to the pharmacy, you can follow this report.</p>
  <div class="box">
    <p><strong>In one page, this is the news:</strong></p>
    <ul>
      <li>The system is already being used in the hospital. It is not a demo.</li>
      <li>Outpatient (OPD) is the strongest part. Staff say it is running well.</li>
      <li>When a doctor writes a prescription, that part is generally working.</li>
      <li>When pharmacy <em>gives out the medicine</em>, staff have had a few problems. We have not yet sat beside them to see the exact problem. That is the main thing to follow up.</li>
      <li>Overall, about <strong>7 out of 10</strong> of the work the hospital asked the system to do is built. That does <strong>not</strong> mean “the hospital is 70% open”. It means most departments have a real screen and a real process, but we have not watched every department finish a full case.</li>
    </ul>
  </div>
  <p class="muted">Nobody’s medical file was opened for this report. No names of patients appear here.</p>
</div>

<h2 class="first">How to read this paper</h2>
<p>Think of AfyaSasa as the hospital’s <strong>shared notebook</strong>. Reception writes the patient’s name. The nurse writes the vitals. The doctor writes the visit. Lab writes the result. Pharmacy writes what was given. Cashier writes what was paid. The Director sees summaries of that notebook.</p>
<p>If one person writes in a paper register and another writes only in the computer, the notebook will look empty even when the ward is busy. This report talks about <strong>what the computer is able to do</strong>, and where staff have already said it works in real life.</p>
<p>Colours used below:</p>
<ul>
  <li><span class="green">WORKING WELL</span> — staff are using it, or the process is complete enough for daily work, with only small caveats.</li>
  <li><span class="amber">BUILT, STILL WATCH</span> — the screens exist, but we have not fully confirmed with staff, or a piece is missing.</li>
  <li><span class="red">NOT READY / GAP</span> — missing, switched off on purpose, or a known problem that needs follow-up.</li>
</ul>
<p><strong>About the “7 out of 10”.</strong> Imagine a checklist of 102 jobs the system is supposed to do (register a patient, give a bed, print a lab report, take M-Pesa, and so on). Most of those jobs exist on the computer. Very few were watched end-to-end by the auditor on this visit. So:</p>
<ul>
  <li><strong>7 out of 10</strong> = the checklist is largely built.</li>
  <li><strong>We did not give 10 out of 10</strong> because we did not sit in every department and complete a real patient journey ourselves.</li>
  <li><strong>We cannot score the live hospital computers in the wards as “the latest version”</strong> without the IT team confirming what is actually running there. This report looked at the system as it exists in the project, and at what staff have already told us.</li>
</ul>

<h2>The patient’s day — from the gate to going home</h2>
<div class="story">
<p><strong>Meet a typical outpatient. Call her Mama A. No real patient is described here.</strong></p>
<ol>
  <li><strong>Reception.</strong> Staff search her name. If she is new, they open a file. If she is already known, they use the old file — they should not create a second Mama A.</li>
  <li><strong>Check-in.</strong> They choose why she came: ordinary clinic, follow-up, referral, or “lab only / x-ray only”. Ordinary clinic sends her toward the nurse and doctor. Lab-only sends her to the laboratory queue, not to a doctor.</li>
  <li><strong>Nurse.</strong> Vitals (pressure, temperature, and so on). Then she waits for her doctor.</li>
  <li><strong>Doctor.</strong> The doctor should mainly see <em>their own</em> queue, not the whole hospital. They write the story of the visit, the diagnosis, and may order lab tests, an x-ray, or a prescription.</li>
  <li><strong>Laboratory or radiology</strong> (if ordered). Sample or image is taken. Someone senior confirms the result before it is treated as final. The doctor can then see it.</li>
  <li><strong>Pharmacy.</strong> The prescription appears as “waiting”. Medicine is <em>not</em> removed from the shelf until the pharmacist confirms. Then the computer reduces stock and raises a bill for those drugs.</li>
  <li><strong>Cashier.</strong> Paying is a separate step. Having a bill is not the same as having paid. After payment, a receipt can be reprinted.</li>
  <li>If Mama A is too sick, <strong>emergency or the ward</strong> takes over. Theatre, maternity, ICU are other rooms in the same notebook, not separate hospitals.</li>
</ol>
</div>
<p>That is the intended flow. Where staff already live this flow (especially OPD), treat it as the backbone of the hospital. Where it breaks (pharmacy issuing medicine is the reported weak point), fix that without tearing down OPD.</p>

<h2>Scoreboard for the Director</h2>
<table>
  <tr><th>Department</th><th>Simple score</th><th>In one sentence</th></tr>
  <tr><td>Reception / Front office</td><td>7 / 10 <span class="amber">BUILT, STILL WATCH</span></td><td>Files, search, and check-in are there. Fingerprint identification needs the fingerprint machine.</td></tr>
  <tr><td>Outpatient (OPD)</td><td>8 / 10 <span class="green">WORKING WELL</span></td><td>Staff say this is running smoothly. Strongest part of the system.</td></tr>
  <tr><td>Pharmacy</td><td>7 / 10 <span class="amber">WATCH THIS</span></td><td>Writing the prescription is generally fine. <strong>Giving out the drug has had a few staff complaints.</strong></td></tr>
  <tr><td>Laboratory</td><td>7 / 10 <span class="amber">BUILT, STILL WATCH</span></td><td>From request to confirmed result is built. Changing a result after it is signed off is currently not allowed (on purpose).</td></tr>
  <tr><td>Radiology / X-ray / scan</td><td>7 / 10 <span class="amber">BUILT, STILL WATCH</span></td><td>Requests and reports are there. It is not a full picture archive like a big imaging centre.</td></tr>
  <tr><td>Wards (IPD), nursing, ICU, HDU</td><td>7 / 10 <span class="amber">BUILT, STILL WATCH</span></td><td>Beds, admit, notes, discharge, ICU and HDU screens exist. We have not walked a full admission with staff for this paper.</td></tr>
  <tr><td>Emergency</td><td>7 / 10 <span class="amber">BUILT, STILL WATCH</span></td><td>Triage, bays, and sending the patient onward exist. Not confirmed beside a real emergency case.</td></tr>
  <tr><td>Theatre</td><td>7 / 10 <span class="amber">BUILT, STILL WATCH</span></td><td>Booking rooms and writing the operation notes exist. Theatre supplies still go through the store, not a magic deduction.</td></tr>
  <tr><td>Maternity</td><td>7 / 10 <span class="amber">BUILT, STILL WATCH</span></td><td>ANC, labour, delivery, baby records exist. Needs midwives to confirm it matches how the labour ward actually works.</td></tr>
  <tr><td>Blood bank</td><td>0 / 10 <span class="red">NOT IN THE SYSTEM</span></td><td>There is no blood bank module. Do not store blood as if it were Panadol in the pharmacy fridge.</td></tr>
  <tr><td>Cashier / bills</td><td>7 / 10 <span class="amber">BUILT, STILL WATCH</span></td><td>Bills and payments are there. Lipa na M-Pesa and QuickBooks accounts need a separate confirmation. Do not treat the Director screen as audited accounts.</td></tr>
  <tr><td>Store / procurement</td><td>6 / 10 <span class="amber">BUILT, STILL WATCH</span></td><td>One store for the whole hospital, including pharmacy shelves. Some stock-count safety nets are not fully locked in yet.</td></tr>
  <tr><td>Reports and Director dashboard</td><td>6 / 10 <span class="amber">USE WITH CARE</span></td><td>You can see activity. Money figures are not the hospital’s official books. Pharmacy “how busy were we” is not shown.</td></tr>
  <tr><td>Insurance / SHA / sharing with government systems</td><td>4 / 10 <span class="amber">STARTED, NOT LIVE</span></td><td>Drafts and checks exist in the computer. This is not the same as SHA having paid, or KHIS having received a return.</td></tr>
  <tr><td><strong>Hospital overall</strong></td><td><strong>7 / 10</strong></td><td><strong>Most departments have a real process. OPD is the live engine. Pharmacy issuing is the main worry. Blood bank is absent.</strong></td></tr>
</table>

<h2>Department by department</h2>

<div class="dept">
<h3>1. Front office — reception</h3>
<p><span class="amber">BUILT, STILL WATCH</span> · Simple score <strong>7 / 10</strong></p>
<p><strong>What this is.</strong> The hospital gate on the computer. This is where a person becomes a patient file.</p>
<p><strong>What staff actually do.</strong></p>
<ol>
  <li>Search: “Do we already know this person?”</li>
  <li>If yes — open the old file. If no — register names, age, contacts, next of kin, allergies.</li>
  <li>The computer tries to stop two files with the same ID number. Two people with similar names are not automatically treated as the same person. That is why searching first matters.</li>
  <li>Check the patient in for today: clinic, type of visit, sometimes the doctor.</li>
  <li>Book a future appointment if needed.</li>
</ol>
<p><strong>What is working.</strong> Search, new file, check-in, appointments. Staff in OPD could not be working if this front door was completely broken — and they report OPD is busy and working.</p>
<p><strong>What to know.</strong></p>
<ul>
  <li>Check-in <strong>shows</strong> the clinic fee on the screen. It does <strong>not</strong> by itself put money on the bill. Cashier still has to record the charge or the payment. So a patient can be seen and still look “unbilled” if cashier was skipped.</li>
  <li>Someone coming only for lab or only for x-ray can be sent there without sitting in the doctor queue.</li>
  <li>Fingerprint identification is only useful if the fingerprint machine is on the desk and working. Without the machine, staff just search by name as usual.</li>
  <li>One person should not be checked in twice the same day for OPD if they already have an open visit. Staff should continue the visit that is already open.</li>
</ul>
</div>

<div class="dept">
<h3>2. Outpatient department (OPD)</h3>
<p><span class="green">WORKING WELL — staff report</span> · Simple score <strong>8 / 10</strong></p>
<p><strong>What this is.</strong> The clinic: nurse, then doctor, then orders, then finish the visit.</p>
<p><strong>The flow.</strong></p>
<ol>
  <li>Patient is already checked in.</li>
  <li>Nurse records vitals and sends onward.</li>
  <li>Doctor sees a list that is mainly <em>their</em> patients, plus people not yet assigned. A supervisor can see everyone.</li>
  <li>Doctor writes the consultation (the story, examination, plan).</li>
  <li>Doctor may add a diagnosis, a lab test, an x-ray, a sick sheet, a referral letter, or a prescription.</li>
  <li>Doctor marks the visit complete. Follow-up date can be set.</li>
</ol>
<p><strong>What is working.</strong> This is the part of the hospital that staff have told us is running efficiently. Treat it as the heart of AfyaSasa. Do not “rebuild OPD” because pharmacy has a dispensing complaint.</p>
<p><strong>What it does not do.</strong> Finishing a visit does not give out medicine. It does not take cash. Emergency is a different desk — a casualty patient is not the same as an OPD clinic patient on the computer.</p>
<p><strong>Caveat.</strong> We did not sit with a doctor for this particular report. We are trusting staff’s day-to-day experience plus what the system is built to do.</p>
</div>

<div class="dept">
<h3>3. Pharmacy — medicines</h3>
<p><span class="amber">PRESCRIBE OK · DISPENSE NEEDS FOLLOW-UP</span> · Simple score <strong>7 / 10</strong></p>
<p><strong>What this is.</strong> The room where medicine leaves the shelf. The pharmacy shelf is the <strong>same store</strong> as the hospital store, just a different cupboard. There are not two different stocks pretending to be one.</p>
<p><strong>The flow, in kitchen language.</strong></p>
<ol>
  <li>Doctor writes the shopping list (the prescription). Nothing is removed from the cupboard yet.</li>
  <li>The list appears for the pharmacist: “these patients are waiting”.</li>
  <li>Pharmacist checks the drug, the quantity, and confirms.</li>
  <li><strong>Only then</strong> the cupboard count goes down, and a bill for those drugs is raised.</li>
  <li>The patient then goes to cashier to pay (unless it is arranged otherwise).</li>
  <li>If only part of the quantity is available, the system can record a partial issue and leave the rest waiting.</li>
  <li>If the cupboard is empty or the stock is expired, the computer should refuse — it should not silently pretend the drug was given.</li>
  <li>Walk-in sales (someone buying without a clinic visit) are a separate button. A walk-in without a patient file may not raise a bill — that is by design, so cashier must know the hospital’s rule for those sales.</li>
</ol>
<div class="warn">
<p><strong>What staff have said.</strong> Prescriptions from the doctor are generally working. <strong>Giving out the medicine has had a few problems.</strong> We did not issue a real prescription while writing this paper, so we cannot yet say “it is the computer” or “it is stock” or “it is the bill” or “it is a slow screen”. That investigation is the first job for the next visit — using a test patient if possible, not a sick person.</p>
<p><strong>What we already suspect, without accusing anyone:</strong> if the prescription does not carry the exact product from the catalogue, the computer may try to match by <em>name</em>. Two different packs with similar names could be confused. That is a safety topic. Also, the computers people are clicking today might not yet include the latest stock-safety updates until IT confirms the version on those machines.</p>
</div>
<p><strong>Nursing “given at the bedside”</strong> is not the same as pharmacy. When a nurse ticks that a tablet was swallowed on the ward, the cupboard in pharmacy does not automatically go down. Ward medicine still needs pharmacy to have issued it.</p>
</div>

<div class="dept">
<h3>4. Laboratory</h3>
<p><span class="amber">BUILT, STILL WATCH</span> · Simple score <strong>7 / 10</strong></p>
<p><strong>The flow.</strong> Doctor (or check-in for lab-only) requests a test → sample is taken and labelled → lab accepts or rejects the sample → results are typed → a <em>different, more senior permission</em> confirms → the report can be read and printed → the doctor sees it in their inbox. Dangerous results have a separate “critical” list.</p>
<p><strong>What is working in the design.</strong> The full lab story is there, including barcodes. If a test has no normal range set in the catalogue, the computer should not pretend the result is “normal”; it should say it could not judge.</p>
<p><strong>What to know.</strong></p>
<ul>
  <li>The person who types the result is not supposed to be the same role that signs it off.</li>
  <li>After a result is signed off, <strong>changing it is currently switched off</strong>. That is usually a good safety rule. If a wrong result went out, that is a management and lab-governance conversation, not a casual edit.</li>
  <li>Lab report layouts still need the laboratory to officially accept the look of the printed form.</li>
</ul>
</div>

<div class="dept">
<h3>5. Radiology (x-ray, scan, imaging)</h3>
<p><span class="amber">BUILT, STILL WATCH</span> · Simple score <strong>7 / 10</strong></p>
<p><strong>The flow.</strong> Request → schedule / do the study → write the report → a senior person confirms → doctor can read it. Files can be attached.</p>
<p><strong>What it is not.</strong> It is not a big-hospital picture library that opens every image like a specialist PACS. Think “request and report”, not “full imaging centre software”.</p>
<p>A patient who came only for imaging can be sent here at check-in without a clinic doctor.</p>
</div>

<div class="dept">
<h3>6. Wards, nursing, ICU and HDU</h3>
<p><span class="amber">BUILT, STILL WATCH</span> · Simple score <strong>7 / 10</strong></p>
<p><strong>The flow.</strong> A bed is given (that bed is now occupied) → doctors write notes → nurses record vitals and who swallowed which medicine → tests and drugs are ordered the same way as OPD → the patient may move ward → a discharge summary is written → only then can discharge be completed → a summary can be printed. Nightly bed charges only appear if prices for those beds have been set. Empty price means no bed charge — the computer will not invent a number.</p>
<p><strong>ICU and HDU</strong> have their own screens (monitoring, ventilator and fluids on ICU, closer watching on HDU). An older rumour that ICU was “not connected” is out of date. We have still not walked a real ICU stay for this paper.</p>
</div>

<div class="dept">
<h3>7. Emergency (casualty)</h3>
<p><span class="amber">BUILT, STILL WATCH</span></p>
<p>Register the emergency, triage how urgent, put the patient in a bay, write notes, observe, then decide: home, clinic, or admit to the ward. This is a <strong>separate book</strong> from the OPD clinic visit, on purpose — casualty is not “a noisy OPD”.</p>
<p>We have not stood in casualty and followed one patient through for this paper.</p>
</div>

<div class="dept">
<h3>8. Theatre</h3>
<p><span class="amber">BUILT, STILL WATCH</span></p>
<p>Rooms, list of operations, booking, team, notes, complications. Gloves and sutures are expected to come through the <strong>store</strong>, not to vanish from a theatre cupboard automatically. If theatre is running on paper plus this screen, the Director should ask which one is the truth for the list.</p>
</div>

<div class="dept">
<h3>9. Maternity</h3>
<p><span class="amber">BUILT, STILL WATCH</span></p>
<p>Pregnancy file, ANC visits, labour, partograph, delivery, postnatal, baby, and linking mother and baby. When a baby is registered as a new patient, staff must not accidentally open a second file for the mother. Midwives need to say whether this matches the labour ward’s real steps. We have not confirmed that beside a delivery.</p>
</div>

<div class="dept">
<h3>10. Blood bank</h3>
<p><span class="red">NOT IN THE SYSTEM</span> · Score <strong>0 / 10</strong></p>
<p>There is no blood bank in AfyaSasa today. Blood should not be treated as just another drug on the pharmacy shelf. If the hospital issues blood, that process is outside this system until a separate project is agreed.</p>
</div>

<div class="dept">
<h3>11. Money — cashier, bills, receipts</h3>
<p><span class="amber">BUILT, STILL WATCH</span> · Simple score <strong>7 / 10</strong></p>
<p>Four words that must not be mixed, even in a meeting:</p>
<table>
  <tr><th>Word</th><th>Meaning in this hospital computer</th></tr>
  <tr><td>Bill (charge)</td><td>What the patient <em>owes</em>. Like a chit. Not money in the drawer.</td></tr>
  <tr><td>Payment</td><td>Money that actually came in (cash, card, insurance, M-Pesa if it completed).</td></tr>
  <tr><td>Receipt</td><td>The paper (or reprint) that proves a payment. It is not a third set of books.</td></tr>
  <tr><td>Hospital accounts (QuickBooks)</td><td>The official books. AfyaSasa is the till and the chits. It is not the accountant’s ledger.</td></tr>
</table>
<p>There is no separate “invoice booklet” in the system as its own thing. Staff work with bills and payments.</p>
<p><strong>Where bills come from.</strong> Pharmacy confirmation can raise a drug bill automatically. Cashier can add a clinic or other service. Ward bed charges can be added if prices exist. Check-in itself does not create the consultation bill.</p>
<p><strong>Paying.</strong> Cashier finds the patient, sees what is unpaid, takes money, can refund with the right permission, can close the till for the shift. M-Pesa is built, but this paper did not send a real STK to anyone’s phone. QuickBooks connection is built, but this paper did not confirm the accountant’s books are receiving it.</p>
<p><strong>For the Director:</strong> numbers on the dashboard that say “billed”, “collected”, and “still owed” are useful for operations. They are <strong>not</strong> audited annual accounts. Collected is not “revenue”. Still owed is a snapshot today, not “this month’s billed minus this month’s collected”.</p>
</div>

<div class="dept">
<h3>12. Store and buying</h3>
<p><span class="amber">BUILT, STILL WATCH</span> · Simple score <strong>6 / 10</strong></p>
<p>Goods arrive, they are received onto a shelf (with batch and expiry). A department can request stock. Stock can move from the main store to pharmacy. Counting (stock take) compares what the computer thinks with what is on the shelf and records the <em>difference</em> — it should not pretend a count is a new delivery.</p>
<p>Pharmacy can only give what is on the pharmacy shelf. If store has not sent paracetamol to pharmacy, the pharmacist will honestly see “not enough”, even if the main store is full.</p>
<p>Some extra locks that stop two people counting or importing the same sheet at the same time are planned but not fully locked into the live database yet. That is an IT/Director decision later — not something to click in a hurry on a busy Friday.</p>
</div>

<div class="dept">
<h3>13. Letters, reports, and the Director’s screen</h3>
<p><span class="amber">USE WITH CARE</span> · Simple score <strong>6 / 10</strong></p>
<p>Staff can keep medical documents on the patient, and hospital policies in a library. There are reports for OPD, wards, emergency, theatre, maternity, and ministry-style forms.</p>
<p><strong>On the Director screen you can usefully see:</strong> how many clinic visits, new files, emergency cases, admissions, discharges, how full the beds are, how many lab or x-ray jobs are waiting.</p>
<p><strong>What you should not do with that screen:</strong></p>
<ul>
  <li>Do not call it the hospital’s profit.</li>
  <li>Do not expect a pharmacy “how many we dispensed today” tile — that number is <em>not shown on purpose</em> until it can be defined honestly. Do not invent it from “stock went down”.</li>
  <li>Do not treat marketing “conversion rates” as real — outreach is logged, but it is not linked cleanly to who later became a patient.</li>
</ul>
<p>Sending reports by email, password-reset emails, and bulk SMS are in the system but <strong>we have not proved they arrive on real phones and inboxes in this hospital</strong>. Do not assume a WhatsApp-style guarantee.</p>
</div>

<div class="dept">
<h3>14. Who can see what (users and trust)</h3>
<p>People log in with their own account. A receptionist should not verify lab results. A lab technician should not be the person who signs off. A pharmacist confirms drugs. Cashier takes money. The Director sees the wide picture, including money tiles that ordinary doctors should not see.</p>
<p>Hiding a menu is not the same as locking the door. The computer is supposed to refuse a forbidden action even if someone is clever. We did not try to break in for this paper. Switching a staff member off (deactivate) is available to administrators when someone leaves.</p>
<p>The computer keeps a diary of important actions. It is not a CCTV camera of every letter typed.</p>
</div>

<div class="dept">
<h3>15. SHA, insurance, and “talking to other systems”</h3>
<p><span class="amber">STARTED, NOT THE SAME AS LIVE PAYMENT</span></p>
<p>Staff can record insurance, draft a claim, and there is a place to check SHA. That is <strong>not</strong> proof that SHA has approved or paid. Government returns (KHIS) can be prepared as forms; this paper does not claim they were submitted and accepted. Sharing with national digital health in the FHIR style is a mapping exercise, not a live national hook-up.</p>
<p>Until the hospital has official live credentials and a successful test that Finance and HIM have signed, treat these as <strong>prepared, not finished</strong>.</p>
</div>

<h2>What is going well</h2>
<ul>
  <li>The hospital already has one system that covers the front gate, clinic, lab, imaging, wards, theatre, maternity, pharmacy, store, and cashier — not five disconnected exercise books.</li>
  <li>OPD, by staff testimony, is the success story. Protect it.</li>
  <li>Doctor prescriptions generally reach pharmacy.</li>
  <li>There is a clear idea of a bill versus a payment versus the accountant’s books. If everyone uses those words the same way, fights about “the system stole money” become easier to settle.</li>
  <li>ICU and HDU are actually in the system (an old note that they were missing should be ignored).</li>
</ul>

<h2>What needs attention — in human language</h2>
<table>
  <tr><th>Priority</th><th>Issue</th><th>What it means on the floor</th><th>What to do next</th></tr>
  <tr><td>High</td><td>Pharmacy giving out drugs — staff complaints</td><td>A patient may wait, get a wrong pack if names collide, or see a bill that does not match the cupboard. We do not yet know which.</td><td>With pharmacy in-charge, try <em>one test prescription</em> (not a sick patient if you can avoid it). Write down the exact message on the screen. Do not guess.</td></tr>
  <tr><td>High</td><td>Are the computers in the rooms on the latest stock safety work?</td><td>IT may have improved the cupboard rules in the project while the machines at the window are still yesterday’s version.</td><td>IT to confirm, in writing, what version is on the pharmacy and store computers. Do not “update production” from this paper.</td></tr>
  <tr><td>Medium</td><td>Director money figures not signed off by Finance</td><td>A meeting can quote “we collected X” when accounts say Y.</td><td>Finance picks one closed week and ticks: billed, collected, owed, QuickBooks. Until then, use the dashboard as a pulse, not a verdict.</td></tr>
  <tr><td>Medium</td><td>Lab printed reports</td><td>The form may not yet be the form the lab is proud to stamp.</td><td>Lab in-charge signs the template.</td></tr>
  <tr><td>Medium</td><td>M-Pesa, email, SHA live</td><td>A patient may be told “the system will send” and nothing arrives.</td><td>Only test in a sandbox or with Finance present. Do not spray real phones from a trial.</td></tr>
  <tr><td>Lower</td><td>No blood bank, no full x-ray picture archive, no pharmacy tile on the Director screen</td><td>Those services, if they exist in the hospital, are not in this computer yet (or not shown).</td><td>Decide later. Do not block OPD for them.</td></tr>
</table>
<p>Nothing in this paper was treated as “the system is harming patients today” with proof. If the pharmacy problem turns out to be <strong>the wrong drug given</strong>, that becomes an immediate clinical incident, not an IT ticket.</p>

<h2>What this report did not do</h2>
<ul>
  <li>Did not change the live hospital system, the database, or anyone’s password.</li>
  <li>Did not open a real patient’s file.</li>
  <li>Did not give out medicine, take cash, send SMS, or call SHA.</li>
  <li>Did not sit in every department for a full shift.</li>
</ul>
<p>So when a Head of Department says “but we use it every day”, they may be right even if this paper says “still watch”. Staff experience and this checklist should be put on one table, not used to fight each other.</p>

<h2>What the Director can say in the next meeting</h2>
<div class="box">
<ol>
  <li>“OPD stays as it is. We are not rebuilding the clinic.”</li>
  <li>“Pharmacy in-charge and IT will capture one failed or successful dispensing on a test patient this week and report the exact screen message.”</li>
  <li>“Finance will not quote dashboard collections as audited income until they have ticked one week against QuickBooks.”</li>
  <li>“There is no blood bank in AfyaSasa. If we issue blood, we say so honestly and we do not hide units inside ordinary drug stock.”</li>
  <li>“SHA on the screen is not the same as SHA has paid.”</li>
  <li>“Overall the computer work is about seven out of ten built. The hospital’s daily engine is OPD. The open worry is pharmacy issuing. Everything else is either in use, waiting for a calm confirmation, or not in the system yet.”</li>
</ol>
</div>
<p class="muted">Prepared 15 October 2026 for Jalaram Hospital leadership. A more technical annex exists for IT if they need file names and test logs; this document is the one to read in a management meeting.</p>
</body>
</html>
"""

OUT.write_text(html, encoding="utf-8")
print("wrote", OUT, OUT.stat().st_size)
