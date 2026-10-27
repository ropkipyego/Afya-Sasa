DROP SCHEMA IF EXISTS demo CASCADE;
CREATE SCHEMA demo;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;

CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  code varchar NOT NULL UNIQUE,
  subdomain varchar NOT NULL UNIQUE,
  schema_name varchar NOT NULL,
  active boolean NOT NULL DEFAULT true,
  address varchar NULL,
  moh_facility_code varchar NULL,
  licence_number varchar NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  sms_sender_name varchar NOT NULL DEFAULT 'AfyaSasa',
  patient_id_prefix varchar NOT NULL DEFAULT 'AFYA',
  triage_system varchar NOT NULL DEFAULT 'manchester_ke',
  clinical_catalog jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE demo.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_no varchar NOT NULL UNIQUE,
  first_name varchar NOT NULL,
  last_name varchar NOT NULL,
  email varchar NOT NULL UNIQUE,
  phone varchar NULL,
  password_hash varchar NOT NULL,
  specialisation varchar NULL,
  kmpdc_licence varchar NULL,
  active boolean NOT NULL DEFAULT true,
  force_password_change boolean NOT NULL DEFAULT false,
  last_login_at timestamptz NULL,
  failed_login_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE demo.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL UNIQUE,
  label varchar NOT NULL,
  description varchar NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE demo.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource varchar NOT NULL,
  action varchar NOT NULL,
  permission_key varchar NOT NULL UNIQUE,
  description varchar NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource, action)
);
CREATE TABLE demo.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES demo.users(id),
  role_id uuid NOT NULL REFERENCES demo.roles(id),
  granted_by uuid NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);
CREATE TABLE demo.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES demo.roles(id),
  permission_id uuid NOT NULL REFERENCES demo.permissions(id),
  granted_by uuid NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);
CREATE TABLE demo.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_no varchar NOT NULL UNIQUE,
  first_name varchar NOT NULL,
  middle_name varchar NULL,
  last_name varchar NOT NULL,
  date_of_birth date NOT NULL,
  gender varchar NOT NULL,
  blood_group varchar NULL,
  nationality varchar NULL,
  marital_status varchar NULL,
  occupation varchar NULL,
  religion varchar NULL,
  education_level varchar NULL,
  primary_phone varchar NOT NULL,
  secondary_phone varchar NULL,
  email varchar NULL,
  county varchar NULL,
  sub_county varchar NULL,
  ward varchar NULL,
  village varchar NULL,
  postal_address varchar NULL,
  photo_url varchar NULL,
  qr_code varchar NOT NULL,
  is_deceased boolean NOT NULL DEFAULT false,
  deceased_at date NULL,
  biometric_enrolled boolean NOT NULL DEFAULT false,
  registered_by uuid NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_no varchar NOT NULL UNIQUE,
  patient_id uuid NOT NULL REFERENCES demo.patients(id),
  type varchar NOT NULL,
  status varchar NOT NULL,
  attending_doctor_id uuid NULL REFERENCES demo.users(id),
  presenting_complaint text NOT NULL,
  visit_type varchar NULL,
  referral_source varchar NULL,
  referral_reason text NULL,
  destination varchar NULL,
  department_name varchar NULL,
  payment_method varchar NULL,
  receipt_number varchar NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.appointment_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES demo.users(id),
  date date NOT NULL,
  start_time varchar NOT NULL,
  end_time varchar NOT NULL,
  max_patients int NOT NULL DEFAULT 1,
  available boolean NOT NULL DEFAULT true,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES demo.patients(id),
  doctor_id uuid NOT NULL REFERENCES demo.users(id),
  slot_id uuid NULL REFERENCES demo.appointment_slots(id),
  appointment_date date NOT NULL,
  appointment_time varchar NOT NULL,
  type varchar NOT NULL,
  reason text NOT NULL,
  status varchar NOT NULL,
  source_encounter_id uuid NULL REFERENCES demo.encounters(id),
  linked_encounter_id uuid NULL REFERENCES demo.encounters(id),
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES demo.patients(id),
  encounter_id uuid NULL REFERENCES demo.encounters(id),
  referring_doctor_id uuid NULL REFERENCES demo.users(id),
  receiving_user_id uuid NULL REFERENCES demo.users(id),
  type varchar NOT NULL,
  target_department varchar NULL,
  target_facility varchar NULL,
  reason text NOT NULL,
  letter text NOT NULL,
  status varchar NOT NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.wards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  code varchar NOT NULL UNIQUE,
  type varchar NOT NULL,
  floor varchar NULL,
  bed_count int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.beds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id uuid NOT NULL REFERENCES demo.wards(id),
  bed_no varchar NOT NULL,
  type varchar NOT NULL,
  status varchar NOT NULL,
  version int NOT NULL DEFAULT 1,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.admissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_no varchar NOT NULL UNIQUE,
  patient_id uuid NOT NULL REFERENCES demo.patients(id),
  encounter_id uuid NULL REFERENCES demo.encounters(id),
  bed_id uuid NOT NULL REFERENCES demo.beds(id),
  ward_id uuid NOT NULL REFERENCES demo.wards(id),
  admitting_doctor_id uuid NULL REFERENCES demo.users(id),
  admitted_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  type varchar NOT NULL,
  status varchar NOT NULL DEFAULT 'active',
  discharged_at timestamptz NULL,
  discharging_doctor_id uuid NULL REFERENCES demo.users(id),
  condition_on_discharge varchar NULL,
  length_of_stay_days int NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.discharge_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id uuid NOT NULL REFERENCES demo.admissions(id),
  presenting_complaint text NOT NULL,
  history text NOT NULL,
  exam_on_admission text NOT NULL,
  investigations_summary text NOT NULL,
  final_diagnosis text NOT NULL,
  treatment_given text NOT NULL,
  discharge_meds text NOT NULL,
  follow_up_instructions text NOT NULL,
  diet text NULL,
  status varchar NOT NULL DEFAULT 'draft',
  finalised_by uuid NULL,
  finalised_at timestamptz NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES demo.encounters(id),
  doctor_id uuid NULL REFERENCES demo.users(id),
  subjective text NOT NULL,
  objective text NOT NULL,
  assessment text NOT NULL,
  plan text NOT NULL,
  status varchar NOT NULL DEFAULT 'draft',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  follow_up_date date NULL,
  follow_up_instructions text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.encounter_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES demo.encounters(id),
  icd10_code varchar NULL,
  description varchar NOT NULL,
  type varchar NOT NULL,
  confirmed boolean NOT NULL DEFAULT false,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku varchar NOT NULL UNIQUE,
  name varchar NOT NULL,
  category varchar NOT NULL,
  drug_class varchar NULL,
  unit varchar NOT NULL,
  strength varchar NULL,
  dosage_form varchar NULL,
  track_batch boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  min_level numeric NULL,
  max_level numeric NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.inventory_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar NOT NULL UNIQUE,
  name varchar NOT NULL,
  location_type varchar NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.inventory_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES demo.inventory_items(id),
  location_id uuid NOT NULL REFERENCES demo.inventory_locations(id),
  batch_no varchar NULL,
  expiry_date date NULL,
  qty_on_hand numeric NOT NULL DEFAULT 0,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES demo.inventory_items(id),
  batch_id uuid NULL REFERENCES demo.inventory_batches(id),
  source_location_id uuid NULL REFERENCES demo.inventory_locations(id),
  destination_location_id uuid NULL REFERENCES demo.inventory_locations(id),
  quantity numeric NOT NULL,
  unit varchar NOT NULL,
  transaction_type varchar NOT NULL,
  reference_type varchar NULL,
  reference_id uuid NULL,
  reason varchar NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.inventory_import_sessions (
  id uuid PRIMARY KEY,
  session_key varchar NOT NULL UNIQUE,
  intent varchar NOT NULL,
  status varchar NOT NULL,
  posted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE demo.inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id varchar NOT NULL,
  clinical_order_id uuid NULL,
  item_id uuid NOT NULL REFERENCES demo.inventory_items(id),
  batch_id uuid NOT NULL REFERENCES demo.inventory_batches(id),
  location_id uuid NOT NULL REFERENCES demo.inventory_locations(id),
  quantity numeric NOT NULL,
  status varchar NOT NULL,
  prepare_op_id varchar NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.inventory_stock_take_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES demo.inventory_locations(id),
  status varchar NOT NULL DEFAULT 'open',
  baseline_at timestamptz NOT NULL DEFAULT now(),
  notes varchar NULL,
  submitted_by uuid NULL,
  submitted_at timestamptz NULL,
  rejected_by uuid NULL,
  rejected_at timestamptz NULL,
  reject_reason varchar NULL,
  approved_by uuid NULL,
  approved_at timestamptz NULL,
  posted_at timestamptz NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.inventory_stock_take_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES demo.inventory_stock_take_sessions(id),
  item_id uuid NOT NULL REFERENCES demo.inventory_items(id),
  batch_id uuid NULL REFERENCES demo.inventory_batches(id),
  expected_qty numeric NOT NULL,
  counted_qty numeric NULL,
  variance_qty numeric NULL,
  reason varchar NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.inventory_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_no varchar NOT NULL UNIQUE,
  requesting_department varchar NOT NULL,
  status varchar NOT NULL,
  destination_location_id uuid NULL REFERENCES demo.inventory_locations(id),
  notes text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.inventory_requisition_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES demo.inventory_requisitions(id),
  item_id uuid NOT NULL REFERENCES demo.inventory_items(id),
  quantity_requested numeric NOT NULL,
  quantity_issued numeric NOT NULL DEFAULT 0,
  fulfillment_route varchar NOT NULL,
  source_location_id uuid NOT NULL REFERENCES demo.inventory_locations(id),
  status varchar NOT NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.inventory_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_no varchar NOT NULL UNIQUE,
  status varchar NOT NULL,
  source_location_id uuid NULL REFERENCES demo.inventory_locations(id),
  destination_location_id uuid NULL REFERENCES demo.inventory_locations(id),
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.inventory_transfer_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES demo.inventory_transfers(id),
  item_id uuid NOT NULL REFERENCES demo.inventory_items(id),
  quantity numeric NOT NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.clinical_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no varchar NOT NULL UNIQUE,
  patient_id uuid NOT NULL REFERENCES demo.patients(id),
  encounter_id uuid NULL REFERENCES demo.encounters(id),
  admission_id uuid NULL REFERENCES demo.admissions(id),
  order_type varchar NOT NULL,
  source_module varchar NOT NULL,
  source_record_id uuid NOT NULL,
  status varchar NOT NULL DEFAULT 'requested',
  priority varchar NOT NULL DEFAULT 'routine',
  ordered_by uuid NULL REFERENCES demo.users(id),
  ordered_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  metadata jsonb NULL,
  client_request_id varchar NULL UNIQUE,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE TABLE demo.lab_results_e2e (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES demo.patients(id),
  encounter_id uuid NOT NULL REFERENCES demo.encounters(id),
  test_name varchar NOT NULL,
  value varchar NOT NULL,
  flag varchar NOT NULL DEFAULT 'normal',
  verified_at timestamptz NULL
);
CREATE TABLE demo.radiology_reports_e2e (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES demo.patients(id),
  encounter_id uuid NOT NULL REFERENCES demo.encounters(id),
  impression text NOT NULL,
  verified_at timestamptz NULL
);
CREATE TABLE demo.charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NULL REFERENCES demo.patients(id),
  encounter_id uuid NULL REFERENCES demo.encounters(id),
  admission_id uuid NULL REFERENCES demo.admissions(id),
  service_line varchar NOT NULL,
  service_entity_id uuid NULL,
  service_description varchar NOT NULL,
  amount_owed numeric NOT NULL,
  amount_paid numeric NOT NULL DEFAULT 0,
  amount_waived numeric NOT NULL DEFAULT 0,
  status varchar NOT NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NULL
);
CREATE TABLE demo.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NULL REFERENCES demo.patients(id),
  charge_id uuid NULL REFERENCES demo.charges(id),
  method varchar NOT NULL,
  status varchar NOT NULL,
  amount numeric NOT NULL,
  external_reference varchar NULL UNIQUE,
  idempotency_key varchar NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NULL
);
CREATE TABLE demo.payment_transactions_e2e (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NULL REFERENCES demo.patients(id),
  amount numeric NOT NULL,
  external_reference varchar NOT NULL UNIQUE,
  idempotency_key varchar NULL UNIQUE
);
CREATE UNIQUE INDEX inventory_stock_take_sessions_open_location
  ON demo.inventory_stock_take_sessions (location_id)
  WHERE status IN ('open', 'submitted', 'rejected') AND deleted_at IS NULL;
CREATE TABLE demo.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NULL,
  endpoint varchar NOT NULL,
  method varchar NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
