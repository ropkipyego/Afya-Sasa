-- Planned only. Do not apply to production from this programme.
-- TYPEORM_MIGRATIONS_RUN must stay false. No live SQL.
--
-- Durable session claim for stock-take / receipt-import. Does NOT create a
-- unique batch index (see 20261014_inventory_batch_unique_index.sql).
-- Ledger history is unchanged: manual receipts keep reference_type = 'receipt';
-- import receipts use 'receipt_import'; stock-takes use 'stock_take'.
-- Session uniqueness lives on this table, not on every inventory_transactions
-- row (one session posts many ledger lines).
--
-- Zero-variance sessions: the application also writes one inventory_transactions
-- row with quantity 0, reason 'Import session posted', same
-- (reference_type, reference_id). Failed posts roll back that row.
-- Do not unique-index all stock_take reference_id values.

CREATE TABLE IF NOT EXISTS demo.inventory_import_sessions (
  id uuid PRIMARY KEY,
  session_key varchar NOT NULL,
  intent varchar NOT NULL,
  status varchar NOT NULL,
  posted_at timestamptz NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_inventory_import_sessions_intent
    CHECK (intent IN ('receipt', 'stock_take')),
  CONSTRAINT chk_inventory_import_sessions_status
    CHECK (status IN ('posted'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_import_sessions_key
  ON demo.inventory_import_sessions (session_key);
