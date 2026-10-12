-- Isolated laboratory schema for integrity tests. Never run against production.
CREATE SCHEMA IF NOT EXISTS demo;

CREATE TABLE IF NOT EXISTS demo.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource varchar NOT NULL,
  action varchar NOT NULL,
  permission_key varchar NOT NULL,
  description varchar,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource, action)
);

CREATE TABLE IF NOT EXISTS demo.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL UNIQUE,
  label varchar NOT NULL,
  description varchar,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS demo.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES demo.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES demo.permissions(id) ON DELETE CASCADE,
  granted_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS demo.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_no varchar NOT NULL UNIQUE,
  first_name varchar NOT NULL,
  last_name varchar NOT NULL,
  gender varchar,
  date_of_birth date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS demo.encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES demo.patients(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS demo.lab_panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  category text NOT NULL,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS demo.lab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id uuid REFERENCES demo.lab_panels(id),
  name text NOT NULL, code text NOT NULL UNIQUE, sample_type text NOT NULL,
  turnaround_hours integer, reference_range text, unit text,
  critical_low numeric, critical_high numeric,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS demo.lab_orderable_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  is_panel boolean NOT NULL DEFAULT false,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS demo.lab_test_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orderable_test_id uuid NOT NULL REFERENCES demo.lab_orderable_tests(id),
  code text NOT NULL,
  name text NOT NULL,
  unit text,
  result_data_type text NOT NULL DEFAULT 'numeric',
  calculated_formula text,
  order_index integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS demo.lab_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES demo.patients(id),
  encounter_id uuid REFERENCES demo.encounters(id),
  request_no text NOT NULL UNIQUE,
  priority text NOT NULL DEFAULT 'routine',
  notes text,
  status text NOT NULL,
  cancelled_reason text,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS demo.lab_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES demo.lab_requests(id),
  test_id uuid REFERENCES demo.lab_tests(id),
  panel_id uuid REFERENCES demo.lab_panels(id),
  orderable_test_id uuid REFERENCES demo.lab_orderable_tests(id),
  status text NOT NULL,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS demo.lab_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES demo.lab_requests(id),
  barcode text NOT NULL UNIQUE,
  type text NOT NULL,
  collected_at timestamptz,
  received_at timestamptz,
  condition text,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS demo.lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_item_id uuid NOT NULL REFERENCES demo.lab_request_items(id),
  sample_id uuid REFERENCES demo.lab_samples(id),
  parameter_id uuid REFERENCES demo.lab_test_parameters(id),
  value text NOT NULL,
  unit text,
  flag text NOT NULL,
  reference_range text,
  is_critical boolean NOT NULL DEFAULT false,
  entered_at timestamptz NOT NULL DEFAULT now(),
  verified_by uuid,
  verified_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS demo.lab_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES demo.lab_requests(id),
  filename varchar NOT NULL,
  mime_type varchar NOT NULL,
  storage_path varchar NOT NULL,
  title varchar,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS demo.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action varchar NOT NULL,
  record_type varchar,
  record_id varchar,
  before_json jsonb,
  after_json jsonb,
  ip varchar,
  user_agent varchar,
  session_id varchar,
  endpoint varchar NOT NULL DEFAULT '/laboratory',
  http_code integer NOT NULL DEFAULT 200,
  duration_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO demo.permissions (resource, action, permission_key, description)
VALUES
  ('lab_requests', 'read', 'lab_requests:read', 'Read lab requests'),
  ('lab_requests', 'create', 'lab_requests:create', 'Create lab requests'),
  ('lab_results', 'enter', 'lab_results:enter', 'Enter lab results'),
  ('lab_results', 'verify', 'lab_results:verify', 'Verify lab results'),
  ('lab_results', 'read', 'lab_results:read', 'Read lab results'),
  ('lab_samples', 'collect', 'lab_samples:collect', 'Collect samples'),
  ('lab_samples', 'receive', 'lab_samples:receive', 'Receive samples'),
  ('lab_attachments', 'create', 'lab_attachments:create', 'Attach files'),
  ('lab_attachments', 'read', 'lab_attachments:read', 'Read attachments')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO demo.roles (name, label) VALUES ('lab_technician', 'Lab technician'), ('doctor', 'Doctor')
ON CONFLICT (name) DO NOTHING;
