# AfyaSasa security matrix

| Control | Status |
| --- | --- |
| JWT access | WORKING |
| Refresh cookie | WORKING |
| Permission guard | WORKING |
| Superadmin policy | WORKING |
| Doctor queue row filter | FIXED |
| Encounter list doctorId scope | WORKING BUT WEAK |
| Password hashing | WORKING |
| Lockout / throttle | WORKING |
| Audit append-only | WORKING |
| SQL injection (TypeORM) | WORKING |
| XSS (React default) | WORKING |
| Secret handling | WORKING — do not print |
| Public M-Pesa callback | WORKING BUT WEAK |
| Public health liveness | ACCEPTABLE |
| Admin system health | WORKING (gated) |
| CORS / TLS | REQUIRES BUSINESS / INFRA DECISION for internet exposure |
| Frontend-only hiding | NOT A CONTROL |
