-- READ ONLY. Do not apply uniqueness until this returns zero rows.
-- Never run against production from an agent session without hospital authorisation.
-- Blank lot keys: application stores missing batch_no as NULL (trim || null).
-- The proposed unique index uses COALESCE(batch_no, ''), so NULL and '' would collide.
-- Expiry is NOT part of the unique key; two lots with the same batch_no and different
-- expiry would be illegal under the proposed index and must be reviewed by hand.

SELECT item_id,
       location_id,
       COALESCE(batch_no, '') AS lot_key,
       count(*) AS rows,
       array_agg(id) AS batch_ids,
       array_agg(expiry_date) AS expiries,
       array_agg(qty_on_hand) AS quantities
  FROM demo.inventory_batches
 WHERE deleted_at IS NULL
 GROUP BY 1, 2, 3
HAVING count(*) > 1;
