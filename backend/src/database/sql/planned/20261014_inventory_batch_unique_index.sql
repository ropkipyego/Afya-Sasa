-- Planned only. Do not apply until a read-only duplicate-lot audit returns
-- zero rows on an authorised non-production snapshot.
-- TYPEORM_MIGRATIONS_RUN must stay false. No live SQL.
--
-- Expiry is NOT part of the key. NULL and '' lot numbers collide under COALESCE.
-- Run 20261014_inventory_batch_duplicate_audit.read-only.sql first.

-- CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_batches_item_location_lot
--   ON demo.inventory_batches (item_id, location_id, COALESCE(batch_no, ''))
--   WHERE deleted_at IS NULL;
