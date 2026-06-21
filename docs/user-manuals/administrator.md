# Administrator Manual

## Purpose

Configure users, roles, departments, tenant settings, audit review, and operational readiness.

## Daily tasks

1. Log in with an Administrator account.
2. Open **User Management**.
3. Create staff accounts and assign roles.
4. Create departments and assign users to departments.
5. Open **Role Permissions** to review permissions.
6. Open **Settings** to update:
   - SMS sender name
   - patient ID prefix
   - triage system
7. Open **Audit** to review recent actions.

## Safety checks

- Every user should have only the roles they need.
- Disable accounts immediately when staff leave.
- Review audit logs after unusual access or data changes.
- Keep `.env` secrets out of screenshots and chat.

## Current limitations

- Full tenant provisioning is still not production-grade.
- Audit before/after snapshots are basic.
- More role-specific dashboards are still being refined.
