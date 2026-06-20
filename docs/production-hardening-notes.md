# AfyaSasa Production Hardening Notes

This repository now includes runnable foundations for Phase 1, Phase 2, skipped Phase 3 placeholders, Phase 4 clinical workflows, and a Phase 5-style reporting layer.

## Implemented hardening/reporting items

- Clinical dashboard metrics
- OPD summary report
- Admissions report
- Discharges report
- Bed occupancy report
- Emergency statistics report
- Disease register
- MOH 705 draft report payload
- CSV-ready report output
- Frontend clinical reporting dashboard

## Still required before production go-live

- Docker Compose runtime validation on a machine with Docker installed
- Real dynamic schema-per-tenant query switching beyond the current seeded demo schema
- Implementation of future Theatre, Maternity, ICU, and HDU modules when approved; architecture is captured in `docs/future-clinical-modules-architecture.md`
- Full integration and browser E2E tests
- Redis-backed permission caching
- Real SMS providers: Africa's Talking and Twilio
- SMTP email transport
- Object-storage bucket bootstrap and signed download URLs
- External security review and penetration testing
- Load testing with realistic clinical workflows
- Backup and restore scripts
- Full OpenAPI review and per-role user manuals
