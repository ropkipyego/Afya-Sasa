# Director and administrator permission matrix (proposal)

**Not a production grant list.** Do not mass-assign these from this programme. Roles stay in `demo.roles` / `role_permissions`. JWT permissions remain `user_roles` ⨯ `role_permissions` ⨯ `permissions.permission_key`. Guards use OR (`required.some`).

| Capability | Director (proposed) | Administrator | Clinical staff |
| --- | --- | --- | --- |
| Executive analytics `/reports/executive-analytics` | `reports:read` | only if assigned | no |
| Operations command `/reports/operations` | `reports:read` | only if assigned | no |
| Reports Centre catalogue `/reports/catalogue` | `reports:read` | only if assigned | no |
| Finance KPIs on the dashboard | `payments:read` in addition to `reports:read` | `payments:read` | no |
| Department exports | matching departmental `*:read` | matching keys | matching clinical keys only |
| Staff directory / activation | no by default | `users:manage` | no |
| Roles matrix | no by default | `roles:manage` | no |
| Hospital settings | no by default | `settings:manage` | no |
| Audit logs | `audit_logs:read` if compliance review is required | `audit_logs:read` | no |
| Patient-level drill-down | requires the corresponding clinical `*:read` | as assigned | as assigned |
| Laboratory cancel / amend | never from this programme | never until clinical sign-off | never |
| Structured lab reports | existing fail-closed lab-access rules | existing rules | existing rules |

Directors are not superadmins. Superadmin remains a platform operator role.

Last-administrator protection already lives in `superadmin-policy.service.ts` (`users:manage`, `roles:manage`, `settings:manage` must remain on at least one account).
