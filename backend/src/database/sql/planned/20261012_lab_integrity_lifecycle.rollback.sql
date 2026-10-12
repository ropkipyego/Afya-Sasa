-- Rollback for 20261012_lab_integrity_lifecycle.sql
-- Safe only when no amendment rows must be retained.
-- DROP COLUMN discards result_comment / supersedes_id / amendment_reason / rejection_reason.
-- Do not run against production from this programme.

DELETE FROM demo.role_permissions rp
USING demo.permissions p
WHERE rp.permission_id = p.id
  AND p.permission_key IN ('lab_results:amend', 'lab_requests:cancel');

DELETE FROM demo.permissions
WHERE permission_key IN ('lab_results:amend', 'lab_requests:cancel');

DROP INDEX IF EXISTS demo.idx_lab_results_active_item_parameter;
DROP INDEX IF EXISTS demo.idx_lab_results_supersedes;

ALTER TABLE demo.lab_results
  DROP COLUMN IF EXISTS result_comment,
  DROP COLUMN IF EXISTS supersedes_id,
  DROP COLUMN IF EXISTS amendment_reason;

ALTER TABLE demo.lab_samples
  DROP COLUMN IF EXISTS rejection_reason;
