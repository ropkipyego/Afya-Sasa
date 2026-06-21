# AfyaSasa Go-Live Checklist

## Local runtime

- [ ] `cp .env.example .env`
- [ ] `npm run preflight` passes
- [ ] `npm run dev` starts all containers
- [ ] `npm run smoke` passes
- [ ] Backend health responds
- [ ] Frontend loads through `http://localhost:8080`
- [ ] Swagger loads at `http://localhost:3000/docs`

## Demo account validation

- [ ] Admin login works
- [ ] Doctor login works
- [ ] Nurse login works
- [ ] Records login works
- [ ] Lab login works
- [ ] Radiology login works

## Core clinical flows

- [ ] Register patient
- [ ] Search patient
- [ ] Open patient profile
- [ ] Review patient clinical timeline
- [ ] Create OPD encounter
- [ ] Record triage
- [ ] Complete doctor consultation
- [ ] Create lab request
- [ ] Collect sample
- [ ] Enter and verify lab result
- [ ] Mark lab result reviewed
- [ ] Create radiology request
- [ ] Write and verify radiology report
- [ ] Mark radiology report reviewed
- [ ] Create ward and bed
- [ ] Admit patient
- [ ] Record vitals
- [ ] Create MAR entry
- [ ] Record shift note
- [ ] Create discharge summary
- [ ] Complete discharge summary
- [ ] Discharge patient

## Specialty flows

- [ ] Emergency registration
- [ ] Critical alert acknowledgement
- [ ] Theatre booking
- [ ] Theatre staff assignment
- [ ] Surgery note
- [ ] Pregnancy registration
- [ ] ANC visit
- [ ] Labour record
- [ ] Delivery record
- [ ] Newborn record
- [ ] ICU admission
- [ ] ICU observation
- [ ] Ventilator record
- [ ] Fluid balance
- [ ] HDU admission
- [ ] HDU observation

## Operations

- [ ] Backup script tested
- [ ] Restore script tested
- [ ] MinIO bucket exists
- [ ] Signed upload URL works
- [ ] Signed download URL works
- [ ] Audit logs visible

## Known production blockers

- [ ] Full dynamic multi-tenant schema switching
- [ ] Cross-tenant isolation tests
- [ ] Browser E2E tests
- [ ] Load testing
- [ ] External security review
- [ ] Live SMS provider test
- [ ] SMTP email setup
