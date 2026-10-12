# Laboratory clinical approval register

All items remain **PENDING** until named Jalaram laboratory/clinical evidence is recorded. No ranges, thresholds, or signatures were invented.

| Decision | Approver role | Evidence needed | Current system behaviour | Deployment impact if unapproved | Status |
| --- | --- | --- | --- | --- | --- |
| Reference intervals and effective dates | Laboratory manager / pathologist | Signed interval list with units and effective dates | Missing/conflict → `unassessed`, never silent Normal | Results stay unassessed; do not copy sample-report numbers | PENDING |
| Age/sex/condition-dependent ranges | Laboratory manager / pathologist | Signed rules for when demographics may select a range | Skip conditional ranges if sex/DOB unknown; overlapping equal-specificity bounds → no auto-pick | Unassessed until signed | PENDING |
| Critical thresholds and alert escalation | Laboratory manager + clinician lead | Signed critical limits and who must acknowledge | Existing catalogue/legacy critical only; notify on enter/verify; ack via review | No new critical limits | PENDING |
| Specimen requirements vs collected sample | Laboratory manager | Signed specimen/container list | Catalogue = requirement; `lab_samples` = actual; adequacy not assumed | Rejection uses observed condition + free-text reason | PENDING |
| Rejection criteria | Laboratory manager | Signed reject list | haemolysed/clotted/insufficient/contaminated + required reason | Do not encode extra clinical reject rules | PENDING |
| Verification and release | Laboratory manager + medical director | Named roles allowed to verify | `lab_results:verify` only | Do not grant verify hospital-wide | PENDING |
| Cancellation | Laboratory manager | Named roles for `lab_requests:cancel` | Endpoint exists; **no role grant** | Cancel stays 403 | PENDING |
| Amendment / corrected-report notification | Laboratory manager + medical director | Who may amend, re-verify, who is notified | Append-only; **flag off**; `lab_results:amend` ungranted | Amend stays 403 / disabled | PENDING |
| Partial panel reporting | Laboratory manager | Whether incomplete panels may be released | Verify blocked if required parameters missing | Incomplete panel banner on report | PENDING |
| Final report design and wording | Laboratory manager | Signed layout / interpretation text | Structured HTML from stored flags | Layout not clinically signed off | PENDING |
| Catalogue mappings legacy ↔ orderable | Laboratory manager | Reviewed code-by-code match list | No auto-relabel of clinical rows | Dual catalogue remains | PENDING |
| eGFR / derived formulas | Pathologist | Written approval to change formulas | Skip eGFR without sex and age; formulas unchanged | Do not change clinical maths | PENDING |
| Department-scoped report access | Medical director + ICT | Decision to add `lab_requests.hospital_department_id` + JWT departments | **Not implemented** — sources cannot be joined; report fail-closed | Do not invent clinic↔lab department mapping | PENDING |
| Unique index on active catalog results | Laboratory manager + ICT | Completed read-only duplicate audit on the authorised database | Script prepared; isolated synthetic dupes classified | Do not enable index if query 1 returns rows | PENDING |
