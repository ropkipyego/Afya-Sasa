-- Disposable schema for inventory locking tests. Never use production.
CREATE SCHEMA IF NOT EXISTS inventory_it;

DROP TABLE IF EXISTS inventory_it.documents CASCADE;
DROP TABLE IF EXISTS inventory_it.charges CASCADE;
DROP TABLE IF EXISTS inventory_it.orders CASCADE;
DROP TABLE IF EXISTS inventory_it.ledger CASCADE;
DROP TABLE IF EXISTS inventory_it.batches CASCADE;
DROP TABLE IF EXISTS inventory_it.sessions CASCADE;

CREATE TABLE inventory_it.batches (
  id uuid PRIMARY KEY,
  item_id uuid NOT NULL,
  location_id uuid NOT NULL,
  batch_no varchar NULL,
  qty_on_hand numeric NOT NULL DEFAULT 0
);

CREATE TABLE inventory_it.ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  batch_id uuid NULL,
  quantity numeric NOT NULL,
  transaction_type varchar NOT NULL,
  reference_type varchar NOT NULL,
  reference_id uuid NULL
);

CREATE TABLE inventory_it.sessions (
  session_key varchar PRIMARY KEY,
  intent varchar NOT NULL,
  status varchar NOT NULL
);

CREATE TABLE inventory_it.orders (
  id uuid PRIMARY KEY,
  remaining numeric NOT NULL,
  status varchar NOT NULL,
  billing_status varchar NOT NULL DEFAULT 'uncharged'
);

CREATE TABLE inventory_it.charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_entity_id varchar NOT NULL,
  amount_owed numeric NOT NULL,
  dispense_ops text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE inventory_it.documents (
  id uuid PRIMARY KEY,
  kind varchar NOT NULL,
  status varchar NOT NULL,
  shipped_qty numeric NOT NULL DEFAULT 0,
  received_qty numeric NOT NULL DEFAULT 0
);
