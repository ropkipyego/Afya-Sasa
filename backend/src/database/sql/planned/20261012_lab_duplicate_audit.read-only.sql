-- Read-only laboratory duplicate audit.
-- Authorised administrator may run this later on a separately approved process.
-- NEVER UPDATE, DELETE, INSERT, or CREATE INDEX from this file.
-- Do not run against production from this development programme.

-- 1) Conflicting ACTIVE catalogue results (same request item + parameter, not an amendment).
-- If this returns rows, idx_lab_results_active_item_parameter must NOT be created until
-- each pair is reviewed. Do not auto-delete. Legitimate amendments have supersedes_id set
-- and are excluded.
SELECT
  'active_catalog_duplicate' AS class,
  r.request_item_id,
  r.parameter_id,
  count(*) AS row_count,
  array_agg(r.id ORDER BY r.entered_at, r.id) AS result_ids,
  array_agg(r.flag ORDER BY r.entered_at, r.id) AS flags,
  array_agg(r.verified_at ORDER BY r.entered_at, r.id) AS verified_at
FROM demo.lab_results r
WHERE r.deleted_at IS NULL
  AND r.supersedes_id IS NULL
  AND r.parameter_id IS NOT NULL
GROUP BY r.request_item_id, r.parameter_id
HAVING count(*) > 1;

-- 2) Amendment chain (legitimate history — not a uniqueness conflict).
SELECT
  'amendment_chain' AS class,
  child.id AS amendment_id,
  child.supersedes_id AS original_id,
  child.amendment_reason,
  child.verified_at AS amendment_verified_at,
  parent.verified_at AS original_verified_at
FROM demo.lab_results child
JOIN demo.lab_results parent ON parent.id = child.supersedes_id
WHERE child.deleted_at IS NULL;

-- 3) Legacy rows (parameter_id IS NULL). PostgreSQL UNIQUE treats NULLs as distinct,
-- so a unique index on (request_item_id, parameter_id) would NOT constrain these.
-- Multiple current legacy values for one item still need human review.
SELECT
  'active_legacy_duplicate' AS class,
  r.request_item_id,
  count(*) AS row_count,
  array_agg(r.id ORDER BY r.entered_at, r.id) AS result_ids
FROM demo.lab_results r
WHERE r.deleted_at IS NULL
  AND r.supersedes_id IS NULL
  AND r.parameter_id IS NULL
GROUP BY r.request_item_id
HAVING count(*) > 1;

-- Enable the unique index only when query 1 returns zero rows.
-- Query 2 may be non-empty (history). Query 3 is out of scope for that index.
