# Laboratory permission matrix (proposal)

**Not applied.** Do not grant these in production from this programme.
Permissions exist only after planned SQL is applied. Inserting `demo.permissions` does not grant them; administrators assign via Roles UI (`/admin/roles` → `role_permissions`).

JWT permissions come from `user_roles` ⨯ `role_permissions` ⨯ `permissions.permission_key`. Guards require **one** of the listed keys (`required.some`). Service-level cancel/amend/report checks are additional.

## Existing keys (already in live schema)

| Key | Typical existing role (from original lab migration) | Notes |
| --- | --- | --- |
| `lab_catalogue:read` | doctor, lab_technician, administrator | Catalogue browse |
| `lab_catalogue:manage` | administrator | Catalogue writes |
| `lab_requests:create` | doctor, administrator | Ordering |
| `lab_requests:read` | doctor, lab_technician, administrator | Worklist / navigation |
| `lab_samples:collect` | lab_technician, administrator | Collection |
| `lab_samples:receive` | lab_technician, administrator | Receipt / rejection |
| `lab_results:enter` | lab_technician, administrator | Draft results |
| `lab_results:verify` | lab_technician, administrator | Verification / report print (interim) |
| `lab_results:read` | doctor, lab_technician, administrator | Inbox; **not** sufficient alone for structured report HTML |
| `lab_attachments:*` | lab_technician, administrator | PDFs; not a substitute for structured results |

## New keys (planned SQL only; **no role_permissions rows**)

| Key | Proposed grant after clinical/admin review | Must not auto-grant to |
| --- | --- | --- |
| `lab_requests:cancel` | Named laboratory supervisor role, or a **named** subset of `lab_technician` after sign-off | all doctors, all nurses, every lab technician by default |
| `lab_results:amend` | Leave unassigned until amendment policy and `AFYASASA_LAB_AMENDMENT_ENABLED=true` | every role, including administrator, until policy exists |

Administrator can assign via the existing Roles panel. Superadmin-protected roles stay locked for non-superadmins.

## Structured report access (interim, fail-closed)

Department scope **cannot** be implemented: `user_departments` → hospital `departments`; catalogue `lab_departments` are HEM/CC/SER; JWT has no department ids; `encounters.department_name` is free text.

Until a single hospital-department id is stored on `lab_requests` **and** in the access token, report HTML is allowed only if:

1. `lab_results:read`, and
2. the caller is the request `createdBy`, **or** has `lab_results:verify`, **or** has role `administrator` / `superadmin`.

Cross-clinician `lab_results:read` without those is **denied**.

## Architectural requirement (blocked)

To department-scope reports later: persist `lab_requests.hospital_department_id` referencing `demo.departments`, put department ids on the JWT from `user_departments`, and match them. Do not map catalogue HEM/CC codes onto clinic departments by guesswork.
