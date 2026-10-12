-- Additive laboratory integrity columns and permissions.
-- NOT applied to production by this programme. Review and run only with hospital authorisation.
-- Permissions live in demo.permissions (resource, action, permission_key), unique (resource, action).
-- Inserting a permission row does NOT grant it. role_permissions must be assigned by an administrator
-- after clinical policy. Cancel/amend stay denied until that grant.
-- Existing verified results are not rewritten. Historical flag='normal' rows stay as stored.

ALTER TABLE demo.lab_results
  ADD COLUMN IF NOT EXISTS result_comment text NULL,
  ADD COLUMN IF NOT EXISTS supersedes_id uuid NULL REFERENCES demo.lab_results(id),
  ADD COLUMN IF NOT EXISTS amendment_reason text NULL;

ALTER TABLE demo.lab_samples
  ADD COLUMN IF NOT EXISTS rejection_reason text NULL;

CREATE INDEX IF NOT EXISTS idx_lab_results_supersedes
  ON demo.lab_results (supersedes_id);

-- Optional after a duplicate audit returns zero rows. Do not auto-delete duplicates.
-- SELECT request_item_id, parameter_id, count(*) FROM demo.lab_results
--  WHERE deleted_at IS NULL AND supersedes_id IS NULL AND parameter_id IS NOT NULL
--  GROUP BY 1, 2 HAVING count(*) > 1;
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_results_active_item_parameter
--   ON demo.lab_results (request_item_id, parameter_id)
--   WHERE deleted_at IS NULL AND supersedes_id IS NULL AND parameter_id IS NOT NULL;

INSERT INTO demo.permissions (resource, action, permission_key, description)
VALUES
  ('lab_results', 'amend', 'lab_results:amend', 'Record an append-only laboratory result amendment'),
  ('lab_requests', 'cancel', 'lab_requests:cancel', 'Cancel a laboratory request with a reason')
ON CONFLICT (resource, action) DO NOTHING;
