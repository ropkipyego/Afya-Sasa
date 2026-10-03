# AfyaSasa final data flow

Inspection + doctor-queue fix: 2 October 2026.

```text
ONE PATIENT (demo.patients + patient_identifiers)
        ↓
ONE ENCOUNTER (demo.encounters)
        ↓
ONE CLINICAL WORKFLOW
   triage → attending doctor → consultation
   clinical_orders → lab / radiology / pharmacy / referral
   admission → bed → nursing → discharge
        ↓
ONE BILLING ACCOUNT
   catalogue (settings JSON + clinic fees + lab prices)
   demo.charges ← source event
   demo.payment_transactions
   QuickBooks = only GL (queue / web connector)
        ↓
MOH REPORTING
   projection of canonical records
   705A / 705B / 706 / 717 generate-export-print
        ↓
DHA / HIE
   SHA eligibility client only today
   SHR / CR / consent / claims = not connected
        ↓
AUDIT
   demo.audit_logs (append-only)
```

## Doctor consultation routing (enforced)

```text
Patient → Encounter.attending_doctor_id → Consultation.doctor_id → GET /opd/doctor/queue
```

- Doctor sees unassigned visits and visits assigned to that doctor
- Doctor does not see another doctor's assigned visit
- Administrator / superadmin / director / settings:manage see the hospital queue
- Frontend filter is not the control

## Live update path

```text
check-in / triage / SOAP / complete
  → PostgreSQL
  → encounter.updated (Socket.IO) when client present
  → React Query invalidate doctor-queue
  → 20s poll + 45s hospital sync fallback
```

## What must never be duplicated

- Second Patient table
- Second Encounter system
- Second Charges or Payments ledger
- Second admission/billing engine
- Per-MOH patient tables
- Fake DHA databases
