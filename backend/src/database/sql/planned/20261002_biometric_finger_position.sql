-- Additive only. Does not drop or rewrite biometric identities.
-- Applied with IF NOT EXISTS after a production count check. Not TypeORM migrate.

ALTER TABLE demo.biometric_identities
  ADD COLUMN IF NOT EXISTS finger_position varchar NULL;
