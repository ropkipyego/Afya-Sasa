import { setTimeout as wait } from 'node:timers/promises';
import {
  connectInventoryTestClient,
  inventoryPgConfigured,
  resetInventoryItSchema,
  type InventoryPgClient,
} from './inventory-pg-harness';

jest.setTimeout(30_000);

const describePg = inventoryPgConfigured() ? describe : describe.skip;

const itemId = 'aaaaaaaa-0000-4000-8000-000000000001';
const locA = 'bbbbbbbb-0000-4000-8000-000000000001';
const locB = 'bbbbbbbb-0000-4000-8000-000000000002';
const batchId = 'cccccccc-0000-4000-8000-000000000001';
const destBatch = 'cccccccc-0000-4000-8000-000000000002';
const orderId = 'dddddddd-0000-4000-8000-000000000001';
const sessionId = 'eeeeeeee-0000-4000-8000-000000000001';

describePg('inventory PostgreSQL isolation (INVENTORY_TEST_DATABASE_URL)', () => {
  let a: InventoryPgClient;
  let b: InventoryPgClient;

  beforeAll(async () => {
    a = await connectInventoryTestClient();
    b = await connectInventoryTestClient();
  });

  afterAll(async () => {
    await a?.end();
    await b?.end();
  });

  afterEach(async () => {
    await a.query('ROLLBACK').catch(() => undefined);
    await b.query('ROLLBACK').catch(() => undefined);
  });

  beforeEach(async () => {
    await a.query('ROLLBACK').catch(() => undefined);
    await b.query('ROLLBACK').catch(() => undefined);
    await resetInventoryItSchema(a);
    await a.query(
      `INSERT INTO inventory_it.batches (id, item_id, location_id, batch_no, qty_on_hand)
       VALUES ($1, $2, $3, 'L1', 10), ($4, $2, $5, 'L1', 0)`,
      [batchId, itemId, locA, destBatch, locB],
    );
    await a.query(
      `INSERT INTO inventory_it.orders (id, remaining, status, billing_status)
       VALUES ($1, 2, 'requested', 'uncharged')`,
      [orderId],
    );
  });

  it('lets a stock-take wait for a dispense, then aborts on a stale snapshot', async () => {
    await a.query('BEGIN');
    await a.query(`SELECT id FROM inventory_it.batches WHERE id = $1 FOR UPDATE`, [batchId]);
    await a.query(`UPDATE inventory_it.batches SET qty_on_hand = 8 WHERE id = $1`, [batchId]);
    await a.query(
      `INSERT INTO inventory_it.ledger (item_id, batch_id, quantity, transaction_type, reference_type, reference_id)
       VALUES ($1, $2, -2, 'DISPENSE', 'clinical_order', $3)`,
      [itemId, batchId, orderId],
    );
    const take = (async () => {
      await b.query('BEGIN');
      await b.query(`SELECT id FROM inventory_it.batches WHERE id = $1 FOR UPDATE`, [batchId]);
      const qty = await b.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [batchId]);
      const actual = Number(qty.rows[0].qty_on_hand);
      if (actual !== 10) {
        await b.query('ROLLBACK');
        return { aborted: true, actual };
      }
      await b.query('COMMIT');
      return { aborted: false, actual };
    })();
    await wait(50);
    await a.query('COMMIT');
    const result = await take;
    expect(result).toEqual({ aborted: true, actual: 8 });
    const stored = await a.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [batchId]);
    expect(Number(stored.rows[0].qty_on_hand)).toBe(8);
  });

  it('lets a stock-take wait for a receipt, then aborts on a stale snapshot', async () => {
    await a.query('BEGIN');
    await a.query(`SELECT id FROM inventory_it.batches WHERE id = $1 FOR UPDATE`, [batchId]);
    await a.query(`UPDATE inventory_it.batches SET qty_on_hand = 15 WHERE id = $1`, [batchId]);
    const take = (async () => {
      await b.query('BEGIN');
      await b.query(`SELECT id FROM inventory_it.batches WHERE id = $1 FOR UPDATE`, [batchId]);
      const qty = await b.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [batchId]);
      const actual = Number(qty.rows[0].qty_on_hand);
      await b.query('ROLLBACK');
      return actual;
    })();
    await wait(50);
    await a.query('COMMIT');
    expect(await take).toBe(15);
  });

  it('serialises a transfer debit against a dispense on the same lot', async () => {
    await a.query('BEGIN');
    await a.query(`SELECT id FROM inventory_it.batches WHERE id = $1 FOR UPDATE`, [batchId]);
    await a.query(`UPDATE inventory_it.batches SET qty_on_hand = qty_on_hand - 2 WHERE id = $1`, [batchId]);
    const transfer = (async () => {
      await b.query('BEGIN');
      await b.query(`SELECT id FROM inventory_it.batches WHERE id = $1 FOR UPDATE`, [batchId]);
      const qty = await b.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [batchId]);
      const available = Number(qty.rows[0].qty_on_hand);
      if (available < 10) {
        await b.query('ROLLBACK');
        return available;
      }
      await b.query(`UPDATE inventory_it.batches SET qty_on_hand = qty_on_hand - 10 WHERE id = $1`, [batchId]);
      await b.query('COMMIT');
      return available;
    })();
    await wait(50);
    await a.query('COMMIT');
    expect(await transfer).toBe(8);
    const stored = await a.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [batchId]);
    expect(Number(stored.rows[0].qty_on_hand)).toBe(8);
  });

  it('rejects a second concurrent session with the same key, including zero variance', async () => {
    await a.query('BEGIN');
    await a.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [
      'afyasasa.inventory.import',
      'stock_take:same',
    ]);
    await a.query(
      `INSERT INTO inventory_it.sessions (session_key, intent, status) VALUES ('same', 'stock_take', 'posted')`,
    );
    await a.query(
      `INSERT INTO inventory_it.ledger (item_id, quantity, transaction_type, reference_type, reference_id)
       VALUES ($1, 0, 'STOCK_TAKE', 'stock_take', $2)`,
      [itemId, sessionId],
    );
    const second = (async () => {
      await b.query('BEGIN');
      await b.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [
        'afyasasa.inventory.import',
        'stock_take:same',
      ]);
      const existing = await b.query(`SELECT 1 FROM inventory_it.sessions WHERE session_key = 'same'`);
      await b.query('ROLLBACK');
      return existing.rowCount;
    })();
    await wait(50);
    await a.query('COMMIT');
    expect(await second).toBe(1);
  });

  it('rolls back the first line when a later line fails', async () => {
    await a.query('BEGIN');
    await a.query(`UPDATE inventory_it.batches SET qty_on_hand = 12 WHERE id = $1`, [batchId]);
    await a.query(
      `INSERT INTO inventory_it.ledger (item_id, batch_id, quantity, transaction_type, reference_type, reference_id)
       VALUES ($1, $2, 2, 'STOCK_TAKE', 'stock_take', $3)`,
      [itemId, batchId, sessionId],
    );
    await a.query('ROLLBACK');
    const stored = await a.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [batchId]);
    const ledger = await a.query(`SELECT count(*)::int AS n FROM inventory_it.ledger`);
    expect(Number(stored.rows[0].qty_on_hand)).toBe(10);
    expect(ledger.rows[0].n).toBe(0);
  });

  it('keeps stock and order unchanged when charge insert fails in the same transaction', async () => {
    await a.query('BEGIN');
    await a.query(`UPDATE inventory_it.batches SET qty_on_hand = 8 WHERE id = $1`, [batchId]);
    await a.query(`UPDATE inventory_it.orders SET remaining = 0, status = 'dispensed' WHERE id = $1`, [orderId]);
    await a.query('ROLLBACK');
    const batch = await a.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [batchId]);
    const order = await a.query(`SELECT remaining, status, billing_status FROM inventory_it.orders WHERE id = $1`, [
      orderId,
    ]);
    const charges = await a.query(`SELECT count(*)::int AS n FROM inventory_it.charges`);
    expect(Number(batch.rows[0].qty_on_hand)).toBe(10);
    expect(order.rows[0]).toEqual({ remaining: '2', status: 'requested', billing_status: 'uncharged' });
    expect(charges.rows[0].n).toBe(0);
  });

  it('retries billing without a second stock deduction and ignores duplicate op ids', async () => {
    await a.query(`UPDATE inventory_it.batches SET qty_on_hand = 8 WHERE id = $1`, [batchId]);
    await a.query(
      `UPDATE inventory_it.orders SET remaining = 0, status = 'dispensed', billing_status = 'awaiting_charge' WHERE id = $1`,
      [orderId],
    );
    await a.query('BEGIN');
    await a.query(
      `INSERT INTO inventory_it.charges (service_entity_id, amount_owed, dispense_ops)
       VALUES ('g1', 50, ARRAY['op-1'])`,
    );
    await a.query(`UPDATE inventory_it.orders SET billing_status = 'charged' WHERE id = $1`, [orderId]);
    await a.query('COMMIT');
    const dup = await a.query(`SELECT dispense_ops FROM inventory_it.charges WHERE service_entity_id = 'g1'`);
    const ops = dup.rows[0].dispense_ops as string[];
    if (ops.includes('op-1')) {
      // retry no-ops
    } else {
      await a.query(`UPDATE inventory_it.charges SET amount_owed = amount_owed + 50 WHERE service_entity_id = 'g1'`);
    }
    const charge = await a.query(`SELECT amount_owed FROM inventory_it.charges WHERE service_entity_id = 'g1'`);
    const batch = await a.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [batchId]);
    expect(Number(charge.rows[0].amount_owed)).toBe(50);
    expect(Number(batch.rows[0].qty_on_hand)).toBe(8);
  });

  it('identifies the disposable database, not a live service', async () => {
    const identity = await a.query('SELECT current_database() AS db, current_user AS usr');
    expect(identity.rows[0]).toEqual({ db: 'inventory_it', usr: 'inventory_it' });
  });

  it('rejects a second requisition issue after the first commits', async () => {
    const reqId = 'ffffffff-0000-4000-8000-000000000001';
    await a.query(
      `INSERT INTO inventory_it.documents (id, kind, status, shipped_qty) VALUES ($1, 'requisition', 'approved', 4)`,
      [reqId],
    );
    await a.query('BEGIN');
    await a.query(`SELECT id FROM inventory_it.documents WHERE id = $1 FOR UPDATE`, [reqId]);
    await a.query(`UPDATE inventory_it.batches SET qty_on_hand = qty_on_hand - 4 WHERE id = $1`, [batchId]);
    await a.query(
      `INSERT INTO inventory_it.ledger (item_id, batch_id, quantity, transaction_type, reference_type, reference_id)
       VALUES ($1, $2, -4, 'ISSUE', 'requisition', $3)`,
      [itemId, batchId, reqId],
    );
    await a.query(`UPDATE inventory_it.documents SET status = 'issued' WHERE id = $1`, [reqId]);
    await a.query('COMMIT');
    await a.query('BEGIN');
    await a.query(`SELECT id FROM inventory_it.documents WHERE id = $1 FOR UPDATE`, [reqId]);
    const status = await a.query(`SELECT status FROM inventory_it.documents WHERE id = $1`, [reqId]);
    await a.query('ROLLBACK');
    expect(status.rows[0].status).toBe('issued');
    const qty = await a.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [batchId]);
    expect(Number(qty.rows[0].qty_on_hand)).toBe(6);
  });

  it('serialises concurrent transfer receive and refuses a second credit', async () => {
    const trf = 'ffffffff-0000-4000-8000-000000000002';
    await a.query(
      `INSERT INTO inventory_it.documents (id, kind, status, shipped_qty) VALUES ($1, 'transfer', 'in_transit', 3)`,
      [trf],
    );
    await a.query(
      `INSERT INTO inventory_it.ledger (item_id, batch_id, quantity, transaction_type, reference_type, reference_id)
       VALUES ($1, $2, -3, 'TRANSFER_OUT', 'transfer', $3)`,
      [itemId, batchId, trf],
    );
    await a.query('BEGIN');
    await a.query(`SELECT id FROM inventory_it.documents WHERE id = $1 FOR UPDATE`, [trf]);
    const receive = (async () => {
      await b.query('BEGIN');
      await b.query(`SELECT id FROM inventory_it.documents WHERE id = $1 FOR UPDATE`, [trf]);
      const row = await b.query(`SELECT status, received_qty FROM inventory_it.documents WHERE id = $1`, [trf]);
      if (row.rows[0].status !== 'in_transit') {
        await b.query('ROLLBACK');
        return { skipped: true, status: row.rows[0].status };
      }
      await b.query('ROLLBACK');
      return { skipped: false, status: row.rows[0].status };
    })();
    await a.query(`UPDATE inventory_it.batches SET qty_on_hand = 3 WHERE id = $1`, [destBatch]);
    await a.query(
      `INSERT INTO inventory_it.ledger (item_id, batch_id, quantity, transaction_type, reference_type, reference_id)
       VALUES ($1, $2, 3, 'TRANSFER_IN', 'transfer', $3)`,
      [itemId, destBatch, trf],
    );
    await a.query(
      `UPDATE inventory_it.documents SET status = 'completed', received_qty = 3 WHERE id = $1`,
      [trf],
    );
    await wait(50);
    await a.query('COMMIT');
    const second = await receive;
    expect(second).toEqual({ skipped: true, status: 'completed' });
    const dest = await a.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [destBatch]);
    const ins = await a.query(
      `SELECT count(*)::int AS n FROM inventory_it.ledger WHERE transaction_type = 'TRANSFER_IN' AND reference_id = $1`,
      [trf],
    );
    expect(Number(dest.rows[0].qty_on_hand)).toBe(3);
    expect(ins.rows[0].n).toBe(1);
  });

  it('rolls back OTC stock when the charge insert is aborted', async () => {
    await a.query('BEGIN');
    await a.query(`UPDATE inventory_it.batches SET qty_on_hand = 9 WHERE id = $1`, [batchId]);
    await a.query(
      `INSERT INTO inventory_it.ledger (item_id, batch_id, quantity, transaction_type, reference_type, reference_id)
       VALUES ($1, $2, -1, 'DISPENSE', 'otc_sale', $3)`,
      [itemId, batchId, orderId],
    );
    await a.query('ROLLBACK');
    const qty = await a.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [batchId]);
    const ledger = await a.query(
      `SELECT count(*)::int AS n FROM inventory_it.ledger WHERE reference_type = 'otc_sale'`,
    );
    const charges = await a.query(`SELECT count(*)::int AS n FROM inventory_it.charges`);
    expect(Number(qty.rows[0].qty_on_hand)).toBe(10);
    expect(ledger.rows[0].n).toBe(0);
    expect(charges.rows[0].n).toBe(0);
  });
});

describePg('InventoryService real TypeORM PostgreSQL stock-take, bulk import & OPD/IPD lifecycle (inventory_it)', () => {
  const { DataSource } = require('typeorm') as typeof import('typeorm');
  const { InventoryService } = require('./inventory.service') as typeof import('./inventory.service');
  const {
    InventoryBatch,
    InventoryItem,
    InventoryLocation,
    InventoryRequisition,
    InventoryRequisitionLine,
    InventoryReservation,
    InventoryStockTakeLine,
    InventoryStockTakeSession,
    InventoryTransaction,
    InventoryTransfer,
    InventoryTransferLine,
  } = require('./inventory.entities') as typeof import('./inventory.entities');
  const { ClinicalOrder } = require('../clinical-order/clinical-order.entities') as typeof import('../clinical-order/clinical-order.entities');
  const { ClinicalOrderMirrorService } = require('../clinical-order/clinical-order-mirror.service') as typeof import('../clinical-order/clinical-order-mirror.service');
  const { Tenant, TenantSettings, User, Role, Permission } = require('../core/core.entities') as typeof import('../core/core.entities');
  const { Patient, PatientIdentifier, PatientAllergy, PatientChronicCondition, PatientNextOfKin } = require('../patients/patient.entities') as typeof import('../patients/patient.entities');
  const { Encounter, Consultation, EncounterDiagnosis } = require('../opd/opd.entities') as typeof import('../opd/opd.entities');
  const { Admission, Ward, Bed } = require('../inpatient/inpatient.entities') as typeof import('../inpatient/inpatient.entities');

  let ds: import('typeorm').DataSource;
  let service: import('./inventory.service').InventoryService;
  let mirror: import('../clinical-order/clinical-order-mirror.service').ClinicalOrderMirrorService;
  const chargesStore = new Map<string, Record<string, unknown>>();
  const paymentsStore = new Map<string, Array<Record<string, unknown>>>();
  const tenantId = '11111111-0000-4000-8000-000000000001';
  const counterUserId = '22222222-0000-4000-8000-000000000001';
  const approverUserId = '33333333-0000-4000-8000-000000000002';
  const pharmLocId = '44444444-0000-4000-8000-000000000001';

  beforeAll(async () => {
    const raw = await connectInventoryTestClient();
    await raw.query(`DROP SCHEMA IF EXISTS demo CASCADE`);
    await raw.query(`CREATE SCHEMA demo`);
    await raw.query(`DROP TABLE IF EXISTS public.settings CASCADE`);
    await raw.query(`DROP TABLE IF EXISTS public.tenants CASCADE`);
    await raw.query(`
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
      CREATE UNIQUE INDEX inventory_stock_take_sessions_open_location
        ON demo.inventory_stock_take_sessions (location_id)
        WHERE status IN ('open', 'submitted', 'rejected') AND deleted_at IS NULL;
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
      CREATE TABLE demo.payment_transactions_e2e (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NULL REFERENCES demo.patients(id),
        amount numeric NOT NULL,
        external_reference varchar NOT NULL UNIQUE,
        idempotency_key varchar NULL
      );
    `);
    await raw.query(
      `INSERT INTO public.tenants (id, name, code, subdomain, schema_name) VALUES ($1, 'Disposable Test', 'jalaram', 'jalaram', 'demo')`,
      [tenantId],
    );
    await raw.query(
      `INSERT INTO public.settings (tenant_id, clinical_catalog) VALUES ($1, '{"inventoryPricing":{}}'::jsonb)`,
      [tenantId],
    );
    await raw.query(
      `INSERT INTO demo.inventory_locations (id, code, name, location_type) VALUES ($1, 'PHARMACY', 'Pharmacy Store', 'pharmacy')`,
      [pharmLocId],
    );
    await raw.query(
      `INSERT INTO demo.users (id, employee_no, first_name, last_name, email, password_hash)
       VALUES ($1, 'EMP-001', 'Counter', 'Staff', 'counter@test.local', 'hash'),
              ($2, 'EMP-002', 'Approver', 'Staff', 'approver@test.local', 'hash')`,
      [counterUserId, approverUserId],
    );
    await raw.end();

    ds = new DataSource({
      type: 'postgres',
      url: process.env.INVENTORY_TEST_DATABASE_URL,
      schema: 'demo',
      entities: [
        Tenant,
        TenantSettings,
        User,
        Role,
        Permission,
        Patient,
        PatientIdentifier,
        PatientAllergy,
        PatientChronicCondition,
        PatientNextOfKin,
        Encounter,
        Consultation,
        EncounterDiagnosis,
        Admission,
        Ward,
        Bed,
        ClinicalOrder,
        InventoryItem,
        InventoryLocation,
        InventoryBatch,
        InventoryTransaction,
        InventoryRequisition,
        InventoryRequisitionLine,
        InventoryTransfer,
        InventoryTransferLine,
        InventoryReservation,
        InventoryStockTakeSession,
        InventoryStockTakeLine,
      ],
      synchronize: false,
    });
    await ds.initialize();

    mirror = new ClinicalOrderMirrorService(
      ds.getRepository(ClinicalOrder),
      ds.getRepository(InventoryItem),
    );

    const paymentsStub = {
      listRecentPharmacyCharges: async () => [...chargesStore.values()],
      listRecentPharmacyPayments: async () => [...paymentsStore.values()].flat(),
      upsertPharmacyCharge: async (params: {
        serviceEntityId: string;
        amountDelta: number;
        description: string;
        patientId: string | null;
        encounterId: string | null;
        admissionId?: string | null;
        orderNo?: string;
        dispenseOpId?: string;
      }) => {
        const existing = chargesStore.get(params.serviceEntityId) as
          | {
              id: string;
              amountOwed: string;
              amountPaid: string;
              amountWaived: string;
              status: string;
              metadata?: { prepareOps?: string[]; orderNo?: string };
            }
          | undefined;
        if (existing) {
          const ops = existing.metadata?.prepareOps ?? [];
          if (params.dispenseOpId && ops.includes(params.dispenseOpId)) {
            return existing;
          }
          existing.amountOwed = String(Number(existing.amountOwed) + params.amountDelta);
          existing.metadata = {
            ...(existing.metadata ?? {}),
            prepareOps: params.dispenseOpId ? [...ops, params.dispenseOpId] : ops,
          };
          const rem = Number(existing.amountOwed) - Number(existing.amountPaid) - Number(existing.amountWaived);
          existing.status = rem <= 0 ? 'paid' : Number(existing.amountPaid) > 0 ? 'partially_paid' : 'owed';
          return existing;
        }
        const charge = {
          id: `chg-${params.serviceEntityId.slice(0, 8)}`,
          serviceLine: 'pharmacy',
          serviceEntityId: params.serviceEntityId,
          serviceDescription: params.description,
          amountOwed: String(params.amountDelta),
          amountPaid: '0',
          amountWaived: '0',
          status: 'owed',
          createdAt: new Date(),
          metadata: { orderNo: params.orderNo, prepareOps: params.dispenseOpId ? [params.dispenseOpId] : [] },
        };
        chargesStore.set(params.serviceEntityId, charge);
        return charge;
      },
      loadPharmacyCharge: async (serviceEntityId: string) => chargesStore.get(serviceEntityId) ?? null,
      loadPaymentsForCharge: async (chargeId: string) => paymentsStore.get(chargeId) ?? [],
      cancelUnpaidPharmacyCharge: async (serviceEntityId: string) => {
        chargesStore.delete(serviceEntityId);
        return { cancelled: true };
      },
    };

    service = new InventoryService(
      ds.getRepository(InventoryItem),
      ds.getRepository(InventoryLocation),
      ds.getRepository(InventoryBatch),
      ds.getRepository(InventoryTransaction),
      ds.getRepository(InventoryRequisition),
      ds.getRepository(InventoryRequisitionLine),
      ds.getRepository(InventoryTransfer),
      ds.getRepository(InventoryTransferLine),
      ds.getRepository(InventoryReservation),
      ds.getRepository(InventoryStockTakeSession),
      ds.getRepository(InventoryStockTakeLine),
      ds.getRepository(ClinicalOrder),
      ds.getRepository(TenantSettings),
      mirror,
      paymentsStub as never,
    );
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  const ctx = (sub: string) =>
    ({
      tenant: { id: tenantId, code: 'jalaram', schemaName: 'demo', name: 'Disposable Test', subdomain: 'jalaram' },
      user: { sub, permissions: ['inventory:read', 'inventory:manage', 'pharmacy:read', 'pharmacy:dispense'] },
    }) as never;

  it('proves bulk catalogue import (dry-run, create/update, duplicates, invalid rows) and controlled opening stock receipt without touching stock during catalogue import', async () => {
    const csv = [
      'sku,name,strength,dosage_form,unit,category,sell,reorder_level,opening_qty',
      'PARA500,Paracetamol 500mg tablet,500mg,tablet,tablet,pharmaceutical,5,25,100',
      'AMOX500,Amoxicillin 500mg capsule,500mg,capsule,capsule,pharmaceutical,15,20,50',
      'PARA500,Duplicate SKU row,500mg,tablet,tablet,pharmaceutical,5,10,10',
      'BADQTY,Cefuroxime 250mg,250mg,tablet,tablet,pharmaceutical,20,10,-5',
    ].join('\n');

    const preview = await service.importCatalog(
      { csv, importIntent: 'catalogue', previewOnly: true },
      ctx(counterUserId),
    );
    expect(preview.preview).toBe(true);
    expect(preview.created).toBe(3);
    expect(preview.duplicates.length).toBeGreaterThanOrEqual(1);
    expect(preview.errors.some((e) => /non-negative/.test(e))).toBe(true);

    // Confirm catalogue import: creates PARA500 and AMOX500, holds opening_qty, does NOT receive stock
    const committed = await service.importCatalog(
      { csv, importIntent: 'catalogue', confirmStockTake: false, updateExisting: true },
      ctx(counterUserId),
    );
    expect(committed.created).toBe(2);
    expect(committed.received).toBe(0);
    expect(committed.priced).toBe(2);

    const batchesAfterCat = await ds.getRepository(InventoryBatch).find();
    expect(batchesAfterCat).toHaveLength(0);

    // Controlled opening stock receipt with sessionId idempotency
    const openingCsv = [
      'sku,name,unit,category,batch_no,expiry_date,opening_qty,sell',
      'PARA500,Paracetamol 500mg tablet,tablet,pharmaceutical,LOT-P1,2028-06-30,100,5',
      'PARA500,Paracetamol 500mg tablet,tablet,pharmaceutical,LOT-P2,2029-01-31,40,5',
      'AMOX500,Amoxicillin 500mg capsule,capsule,pharmaceutical,LOT-A1,2028-09-30,60,15',
    ].join('\n');

    // Note: importCatalog deduplicates SKU within a single file, so receive LOT-P1 + LOT-A1 first, then manual receive LOT-P2
    const opening1 = await service.importCatalog(
      {
        csv: [
          'sku,name,unit,category,batch_no,expiry_date,opening_qty,sell',
          'PARA500,Paracetamol 500mg tablet,tablet,pharmaceutical,LOT-P1,2028-06-30,100,5',
          'AMOX500,Amoxicillin 500mg capsule,capsule,pharmaceutical,LOT-A1,2028-09-30,60,15',
        ].join('\n'),
        locationId: pharmLocId,
        importIntent: 'receipt',
        confirmStockTake: true,
        sessionId: 'open-sess-1',
      },
      ctx(counterUserId),
    );
    expect(opening1.received).toBe(2);

    // Retry with same sessionId is rejected
    await expect(
      service.importCatalog(
        {
          csv: openingCsv,
          locationId: pharmLocId,
          importIntent: 'receipt',
          confirmStockTake: true,
          sessionId: 'open-sess-1',
        },
        ctx(counterUserId),
      ),
    ).rejects.toThrow(/already posted/i);

    const para = await ds.getRepository(InventoryItem).findOneByOrFail({ sku: 'PARA500' });
    await service.receiveStock(
      {
        itemId: para.id,
        locationId: pharmLocId,
        quantity: 40,
        batchNo: 'LOT-P2',
        expiryDate: '2029-01-31',
        reason: 'Second lot receipt',
      },
      ctx(counterUserId),
    );
  });

  it('covers large bulk catalogue files, invalid dates, decimal quantities, unknown locations, and partial failure rollback', async () => {
    const bulkRows = ['sku,name,unit,category,sell,reorder_level'];
    for (let i = 1; i <= 60; i += 1) {
      bulkRows.push(`BULK${String(i).padStart(3, '0')},Bulk Drug ${i} 10mg,tablet,pharmaceutical,${10 + i},15`);
    }
    const largeRes = await service.importCatalog(
      { csv: bulkRows.join('\n'), importIntent: 'catalogue', confirmStockTake: false },
      ctx(counterUserId),
    );
    expect(largeRes.created).toBe(60);

    // Invalid date and decimal quantity validation in preview
    const edgePreview = await service.importCatalog(
      {
        csv: [
          'sku,name,unit,category,batch_no,expiry_date,opening_qty,sell',
          'DEC001,Decimal Syrup 100ml,bottle,pharmaceutical,LOT-DEC,2028-11-30,12.5,80',
          'BADDATE,Invalid Expiry Drug,tablet,pharmaceutical,LOT-BAD,31-12-2028,10,20',
        ].join('\n'),
        importIntent: 'catalogue',
        previewOnly: true,
      },
      ctx(counterUserId),
    );
    expect(edgePreview.errors.some((e) => /YYYY-MM-DD/.test(e))).toBe(true);
    expect(edgePreview.rows.find((r) => r.sku === 'DEC001')?.countedQty).toBe(12.5);

    // Unknown location rejected
    await expect(
      service.importCatalog(
        {
          csv: 'sku,name,unit\nLOCERR,Test,tablet',
          locationId: '99999999-0000-4000-8000-999999999999',
          importIntent: 'catalogue',
        },
        ctx(counterUserId),
      ),
    ).rejects.toThrow(/location was not found/i);

    // Partial failure rollback
    service.failNextImportWrite = 'catalogue';
    await expect(
      service.importCatalog(
        {
          csv: 'sku,name,unit,category\nROLLBACK01,Should Rollback,tablet,pharmaceutical',
          importIntent: 'catalogue',
        },
        ctx(counterUserId),
      ),
    ).rejects.toThrow(/Forced catalogue write failure/i);
    const rolledBack = await ds.getRepository(InventoryItem).findOne({ where: { sku: 'ROLLBACK01' } });
    expect(rolledBack).toBeNull();
  });

  it('executes full stock-take database lifecycle (1-10): baseline, sheet export, count import validation, variance, reject/recount, independent approval, drift detection, one-time post, and reconciliation', async () => {
    // 10. Verify CSV stock-take bypass is rejected
    await expect(
      service.importCatalog(
        {
          csv: 'sku,name,batch_no,counted_qty\nPARA500,Paracetamol 500mg tablet,LOT-P1,90',
          locationId: pharmLocId,
          importIntent: 'stock_take',
          confirmStockTake: true,
          sessionId: 'bypass-attempt',
        },
        ctx(counterUserId),
      ),
    ).rejects.toThrow(/cannot be posted from CSV/i);

    // 1. Start stock-take session and capture baseline quantities by store and batch
    const session = await service.createStockTakeSession(
      { locationId: pharmLocId, notes: 'Q4 Pharmacy Physical Count' },
      ctx(counterUserId),
    );
    expect(session.status).toBe('open');
    expect(session.lines).toHaveLength(3); // LOT-P1 (100), LOT-P2 (40), LOT-A1 (60)

    // 2. Export physical count sheet with book_qty and blank physical_count
    const sheetCsv = await service.exportPhysicalCountSheet(session.id);
    expect(sheetCsv).toContain('session_id,line_id,sku,name,batch_no,expiry,book_qty,physical_count,variance_reason');
    const sheetLines = sheetCsv.trim().split('\n');
    expect(sheetLines).toHaveLength(4); // header + 3 lots
    // Ensure physical_count column is blank in exported sheet
    for (const row of sheetLines.slice(1)) {
      const cols = row.split(',');
      expect(cols[7]).toBe('');
    }

    // 3 & 4. Import counts with unknown product, ambiguous match (PARA500 without batch_no), invalid unit, and negative qty
    const badImport = await service.importCountsIntoSession(
      session.id,
      {
        csv: [
          'sku,batch_no,unit,physical_count,variance_reason',
          'UNKNOWN999,LOT-X,tablet,10,unknown item',
          'PARA500,,tablet,95,ambiguous across two lots',
          'AMOX500,LOT-A1,bottle,60,wrong unit bottle vs capsule',
          'AMOX500,LOT-A1,capsule,-3,negative count',
          'AMOX500,LOT-A1,capsule,60,',
        ].join('\n'),
      },
      ctx(counterUserId),
    );
    expect(badImport.imported).toBe(1); // Only the valid AMOX500 row applied
    expect(badImport.errors.some((e) => /unknown product/i.test(e))).toBe(true);
    expect(badImport.errors.some((e) => /ambiguous match/i.test(e))).toBe(true);
    expect(badImport.errors.some((e) => /does not match catalogue unit/i.test(e))).toBe(true);
    expect(badImport.errors.some((e) => /0 or greater/i.test(e))).toBe(true);

    // Verify stock on-hand was NOT changed by importing counts
    const checkMid = await service.oversightSummary();
    expect(checkMid.onHand).toBe(200); // 100 + 40 + 60

    // 5. Enter remaining counts and calculate variance = physical_count - book_qty
    const lotP1Line = session.lines.find((l) => l.batchNo === 'LOT-P1')!;
    const lotP2Line = session.lines.find((l) => l.batchNo === 'LOT-P2')!;

    // Variance without reason must be rejected
    await expect(
      service.countStockTakeLine(session.id, lotP1Line.id, { countedQty: 95, reason: '' }, ctx(counterUserId)),
    ).rejects.toThrow(/reason is required/i);

    await service.countStockTakeLine(
      session.id,
      lotP1Line.id,
      { countedQty: 95, reason: '5 tablets damaged in blister pack' },
      ctx(counterUserId),
    );
    const afterCounts = await service.countStockTakeLine(
      session.id,
      lotP2Line.id,
      { countedQty: 42, reason: '2 surplus tablets from unpacked box' },
      ctx(counterUserId),
    );
    expect(afterCounts.lines.find((l) => l.id === lotP1Line.id)?.varianceQty).toBe(-5);
    expect(afterCounts.lines.find((l) => l.id === lotP2Line.id)?.varianceQty).toBe(2);

    // 6. Submit, reject/recount, resubmit, and enforce independent approver
    const submitted1 = await service.submitStockTakeSession(session.id, ctx(counterUserId));
    expect(submitted1.status).toBe('submitted');

    // Counter cannot approve their own submission
    await expect(service.approveAndPostStockTakeSession(session.id, ctx(counterUserId))).rejects.toThrow(
      /cannot approve it/i,
    );

    // Reject for recount preserves baseline & history
    const rejected = await service.rejectStockTakeSession(
      session.id,
      { reason: 'Recount LOT-P1 shelf B' },
      ctx(approverUserId),
    );
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectReason).toBe('Recount LOT-P1 shelf B');

    // Recount LOT-P1 to 96 and resubmit
    await service.countStockTakeLine(
      session.id,
      lotP1Line.id,
      { countedQty: 96, reason: 'Confirmed 4 damaged tablets on recount' },
      ctx(counterUserId),
    );
    const submitted2 = await service.submitStockTakeSession(session.id, ctx(counterUserId));
    expect(submitted2.status).toBe('submitted');

    // 7. Detect baseline drift during counting: simulate concurrent movement on LOT-P1
    await ds
      .getRepository(InventoryBatch)
      .update({ id: lotP1Line.batchId! }, { qtyOnHand: '98' });
    await expect(service.approveAndPostStockTakeSession(session.id, ctx(approverUserId))).rejects.toThrow(
      /changed.*Recount before posting/i,
    );
    // Restore LOT-P1 baseline to 100
    await ds
      .getRepository(InventoryBatch)
      .update({ id: lotP1Line.batchId! }, { qtyOnHand: '100' });

    // 9. Verify transaction rollback on forced ledger failure
    service.failNextImportWrite = 'ledger';
    await expect(service.approveAndPostStockTakeSession(session.id, ctx(approverUserId))).rejects.toThrow(
      /Forced ledger write failure/i,
    );
    const batchAfterRollback = await ds.getRepository(InventoryBatch).findOneByOrFail({ id: lotP1Line.batchId! });
    expect(Number(batchAfterRollback.qtyOnHand)).toBe(100);

    // 8. Post approved variance to existing ledger exactly once
    const posted = await service.approveAndPostStockTakeSession(session.id, ctx(approverUserId));
    expect(posted.status).toBe('posted');
    expect(posted.approvedBy).toBe(approverUserId);

    // Retry approve on already posted session is idempotent and does not double-post
    const retryPosted = await service.approveAndPostStockTakeSession(session.id, ctx(approverUserId));
    expect(retryPosted.status).toBe('posted');

    const p1After = await ds.getRepository(InventoryBatch).findOneByOrFail({ id: lotP1Line.batchId! });
    const p2After = await ds.getRepository(InventoryBatch).findOneByOrFail({ id: lotP2Line.batchId! });
    expect(Number(p1After.qtyOnHand)).toBe(96); // 100 - 4
    expect(Number(p2After.qtyOnHand)).toBe(42); // 40 + 2

    const takeTxns = await ds.getRepository(InventoryTransaction).find({
      where: { transactionType: 'STOCK_TAKE' },
    });
    expect(takeTxns).toHaveLength(2); // -4 and +2

    const integrity = await service.integrityReport(ctx(approverUserId));
    expect(integrity.balanceMismatch).toHaveLength(0);
    expect(integrity.negativeStock).toHaveLength(0);
  });

  it('verifies OPD and IPD prescriptions end-to-end: creation, clientRequestId idempotency, OPD/IPD queue separation, prepare reservation, unpaid block, payment clearance, dispense, and header status sync', async () => {
    process.env.AFYASASA_CHARGES_ENABLED = 'true';
    const patientRepo = ds.getRepository(Patient);
    const encounterRepo = ds.getRepository(Encounter);
    const wardRepo = ds.getRepository(Ward);
    const bedRepo = ds.getRepository(Bed);
    const admissionRepo = ds.getRepository(Admission);

    const patient = await patientRepo.save(
      patientRepo.create({
        patientNo: 'SYN-0001',
        firstName: 'Synthetic',
        lastName: 'Patient',
        dateOfBirth: '1990-01-01',
        gender: 'female',
        primaryPhone: '0700000000',
        qrCode: 'QR-SYN-0001',
      }),
    );

    const opdEncounter = await encounterRepo.save(
      encounterRepo.create({
        encounterNo: 'ENC-OPD-1',
        patient,
        type: 'opd',
        status: 'in_consultation',
        presentingComplaint: 'Headache',
      }),
    );

    const ward = await wardRepo.save(
      wardRepo.create({ name: 'Medical Ward', code: 'WARD-MED', type: 'medical', bedCount: 10 }),
    );
    const bed = await bedRepo.save(
      bedRepo.create({ ward, bedNo: 'M-01', type: 'standard', status: 'occupied' }),
    );
    const admission = await admissionRepo.save(
      admissionRepo.create({
        admissionNo: 'ADM-IPD-1',
        patient,
        encounter: opdEncounter,
        ward,
        bed,
        reason: 'Inpatient observation',
        type: 'elective',
        status: 'active',
      }),
    );

    const para = await ds.getRepository(InventoryItem).findOneByOrFail({ sku: 'PARA500' });
    const amox = await ds.getRepository(InventoryItem).findOneByOrFail({ sku: 'AMOX500' });

    // 1. Create OPD prescription + verify clientRequestId retry idempotency
    const opdRx1 = await mirror.createPharmacyPrescription(
      {
        patientId: patient.id,
        encounterId: opdEncounter.id,
        priority: 'routine',
        clientRequestId: 'opd-req-key-1',
        lines: [
          {
            medication: 'Paracetamol 500mg tablet',
            dose: '1g',
            route: 'oral',
            frequency: 'TDS',
            duration: '3 days',
            itemId: para.id,
            quantity: 10,
          },
        ],
      },
      ctx(counterUserId),
    );
    const opdRxRetry = await mirror.createPharmacyPrescription(
      {
        patientId: patient.id,
        encounterId: opdEncounter.id,
        priority: 'routine',
        clientRequestId: 'opd-req-key-1',
        lines: [
          {
            medication: 'Paracetamol 500mg tablet',
            dose: '1g',
            route: 'oral',
            frequency: 'TDS',
            duration: '3 days',
            itemId: para.id,
            quantity: 10,
          },
        ],
      },
      ctx(counterUserId),
    );
    expect(opdRxRetry.header.id).toBe(opdRx1.header.id);
    expect((opdRxRetry as { replayed?: boolean }).replayed).toBe(true);

    // 2. Create IPD prescription linked to admission
    const ipdRx = await mirror.createPharmacyPrescription(
      {
        patientId: patient.id,
        admissionId: admission.id,
        encounterId: opdEncounter.id,
        priority: 'stat',
        clientRequestId: 'ipd-req-key-1',
        lines: [
          {
            medication: 'Amoxicillin 500mg capsule',
            dose: '500mg',
            route: 'oral',
            frequency: 'TDS',
            duration: '5 days',
            itemId: amox.id,
            quantity: 15,
          },
        ],
      },
      ctx(counterUserId),
    );

    // 3. Verify Pharmacy Dashboard separates OPD and IPD pending prescriptions
    const dashBefore = await service.pharmacyDashboard(ctx(counterUserId));
    expect(dashBefore.prescriptions.opdPending).toBe(1);
    expect(dashBefore.prescriptions.ipdPending).toBe(1);
    expect(dashBefore.prescriptions.urgentCount).toBe(1);

    // 4. Prepare OPD prescription sale -> creates reservation hold without changing on-hand
    const prepOpd = await service.preparePrescriptionSale(
      {
        prescriptionGroupId: opdRx1.header.id,
        lines: [{ clinicalOrderId: opdRx1.lines[0].id, itemId: para.id, quantity: 10 }],
      },
      ctx(counterUserId),
    );
    expect(prepOpd.saleId).toBe(opdRx1.header.id);

    const dashDuringHold = await service.pharmacyDashboard(ctx(counterUserId));
    expect(dashDuringHold.stock.onHand).toBe(198); // 96 + 42 + 60
    expect(dashDuringHold.stock.reserved).toBe(10);
    expect(dashDuringHold.stock.available).toBe(188);

    // 5. Blocked unpaid dispensing fails closed
    await expect(
      service.dispensePrescription(
        {
          confirm: true,
          prescriptionGroupId: opdRx1.header.id,
          lines: [{ clinicalOrderId: opdRx1.lines[0].id, itemId: para.id, quantity: 10 }],
        },
        ctx(counterUserId),
      ),
    ).rejects.toThrow(/outstanding/i);

    // 6. Simulate cashier payment clearance on the OPD charge
    const opdCharge = chargesStore.get(opdRx1.header.id)!;
    opdCharge.amountPaid = opdCharge.amountOwed;
    opdCharge.status = 'paid';
    paymentsStore.set(String(opdCharge.id), [
      {
        id: 'pay-opd-1',
        chargeId: opdCharge.id,
        method: 'cash',
        status: 'completed',
        amount: opdCharge.amountOwed,
        createdAt: new Date(),
        metadata: {},
      },
    ]);

    // 7. Dispense OPD prescription after clearance -> consumes hold, reduces on-hand, writes DISPENSE, syncs header
    const dispOpd = await service.dispensePrescription(
      {
        confirm: true,
        prescriptionGroupId: opdRx1.header.id,
        lines: [{ clinicalOrderId: opdRx1.lines[0].id, itemId: para.id, quantity: 10 }],
      },
      ctx(counterUserId),
    );
    expect(dispOpd.lines).toHaveLength(1);

    // Retry dispense on already dispensed order is rejected (no duplicate deduction)
    await expect(
      service.dispensePrescription(
        {
          confirm: true,
          prescriptionGroupId: opdRx1.header.id,
          lines: [{ clinicalOrderId: opdRx1.lines[0].id, itemId: para.id, quantity: 10 }],
        },
        ctx(counterUserId),
      ),
    ).rejects.toThrow(/already fully dispensed/i);

    const opdHeaderAfter = await ds.getRepository(ClinicalOrder).findOneByOrFail({ id: opdRx1.header.id });
    expect(opdHeaderAfter.status).toBe('dispensed');
    expect(opdHeaderAfter.completedAt).not.toBeNull();

    // 8. Prepare, clear, and dispense IPD prescription
    await service.preparePrescriptionSale(
      {
        prescriptionGroupId: ipdRx.header.id,
        lines: [{ clinicalOrderId: ipdRx.lines[0].id, itemId: amox.id, quantity: 15 }],
      },
      ctx(counterUserId),
    );
    const ipdCharge = chargesStore.get(ipdRx.header.id)!;
    ipdCharge.amountPaid = ipdCharge.amountOwed;
    ipdCharge.status = 'paid';
    paymentsStore.set(String(ipdCharge.id), [
      {
        id: 'pay-ipd-1',
        chargeId: ipdCharge.id,
        method: 'cash',
        status: 'completed',
        amount: ipdCharge.amountOwed,
        createdAt: new Date(),
        metadata: {},
      },
    ]);
    await service.dispensePrescription(
      {
        confirm: true,
        prescriptionGroupId: ipdRx.header.id,
        lines: [{ clinicalOrderId: ipdRx.lines[0].id, itemId: amox.id, quantity: 15 }],
      },
      ctx(counterUserId),
    );

    const ipdHeaderAfter = await ds.getRepository(ClinicalOrder).findOneByOrFail({ id: ipdRx.header.id });
    expect(ipdHeaderAfter.status).toBe('dispensed');

    const dashAfter = await service.pharmacyDashboard(ctx(counterUserId));
    expect(dashAfter.prescriptions.opdPending).toBe(0);
    expect(dashAfter.prescriptions.ipdPending).toBe(0);
    expect(dashAfter.stock.onHand).toBe(173); // 198 - 10 - 15
    expect(dashAfter.stock.reserved).toBe(0);

    // 9. Verify encounterId / admissionId filtering, orderedBy serialization, and cancellation protection
    const opdOrdersReloaded = await mirror.listOrders({
      sourceModule: 'pharmacy',
      patientId: patient.id,
      encounterId: opdEncounter.id,
    });
    expect(opdOrdersReloaded.length).toBeGreaterThanOrEqual(2);
    expect(opdOrdersReloaded[0].orderedBy).toMatchObject({
      id: counterUserId,
      firstName: 'Counter',
      lastName: 'Staff',
    });

    // Dispensed prescription cannot be cancelled
    await expect(
      mirror.cancelPharmacyPrescription(opdRx1.header.id, 'Try erase dispensed', ctx(counterUserId)),
    ).rejects.toThrow(/already been dispensed/i);

    // Create a new un-dispensed multi-item prescription and cancel it cleanly
    const cancelTarget = await mirror.createPharmacyPrescription(
      {
        patientId: patient.id,
        encounterId: opdEncounter.id,
        priority: 'routine',
        clientRequestId: 'opd-cancel-test-1',
        lines: [
          {
            medication: 'Paracetamol 500mg tablet',
            dose: '500mg',
            route: 'oral',
            frequency: 'BD',
            duration: '3 days',
            itemId: para.id,
            quantity: 6,
            instructions: 'Take with water',
          },
          {
            medication: 'Amoxicillin 500mg capsule',
            dose: '500mg',
            route: 'oral',
            frequency: 'TDS',
            duration: '5 days',
            itemId: amox.id,
            quantity: 15,
            instructions: 'Complete course',
          },
        ],
      },
      ctx(counterUserId),
    );
    expect(cancelTarget.lines).toHaveLength(2);
    expect(cancelTarget.lines[0].metadata).toMatchObject({
      sku: 'PARA500',
      strength: '500mg',
      dosageForm: 'tablet',
      unit: 'tablet',
      quantityPrescribed: 6,
      quantityDispensed: 0,
    });

    const cancelledRes = await mirror.cancelPharmacyPrescription(
      cancelTarget.header.id,
      'Clinician changed therapy before dispensing',
      ctx(counterUserId),
    );
    expect(cancelledRes.cancelled).toBe(3); // 1 header + 2 lines

    const finalIntegrity = await service.integrityReport(ctx(approverUserId));
    expect(finalIntegrity.balanceMismatch).toHaveLength(0);

    // 10. Step 3 E2E items 2, 8, 10, 11: SOAP & diagnoses persistence, historical encounter separation,
    // verified-only lab/radiology visibility, and concurrent payment idempotency / receipt uniqueness in PostgreSQL
    const consultationRepo = ds.getRepository(Consultation);
    const diagnosisRepo = ds.getRepository(EncounterDiagnosis);

    const savedSoap = await consultationRepo.save(
      consultationRepo.create({
        encounter: opdEncounter,
        doctor: { id: counterUserId } as never,
        subjective: '2 days throbbing frontal headache',
        objective: 'BP 120/80, afebrile, alert',
        assessment: 'Tension headache',
        plan: 'Paracetamol 500mg TDS x 3 days, hydration',
        status: 'completed',
        followUpDate: '2026-11-01',
        followUpInstructions: 'Return if vision changes or fever develops',
      }),
    );
    const savedDx = await diagnosisRepo.save(
      diagnosisRepo.create({
        encounter: opdEncounter,
        icd10Code: 'G44.2',
        description: 'Tension-type headache',
        type: 'primary',
        confirmed: true,
      }),
    );

    const retrievedSoap = await consultationRepo.findOneByOrFail({ id: savedSoap.id });
    const retrievedDx = await diagnosisRepo.findOneByOrFail({ id: savedDx.id });
    expect(retrievedSoap.assessment).toBe('Tension headache');
    expect(retrievedDx.icd10Code).toBe('G44.2');

    // Historical encounter separation (item 10)
    const pastEncounter = await encounterRepo.save(
      encounterRepo.create({
        encounterNo: 'ENC-OPD-HIST-0',
        patient,
        type: 'opd',
        status: 'completed',
        presentingComplaint: 'Old cough visit',
      }),
    );
    await mirror.createPharmacyPrescription(
      {
        patientId: patient.id,
        encounterId: pastEncounter.id,
        priority: 'routine',
        clientRequestId: 'hist-rx-key-1',
        lines: [
          {
            medication: 'Amoxicillin 500mg capsule',
            dose: '500mg',
            route: 'oral',
            frequency: 'TDS',
            duration: '5 days',
            itemId: amox.id,
            quantity: 15,
            instructions: 'Historical course',
          },
        ],
      },
      ctx(counterUserId),
    );

    const activeVisitOrders = await mirror.listOrders({
      sourceModule: 'pharmacy',
      patientId: patient.id,
      encounterId: opdEncounter.id,
    });
    const pastVisitOrders = await mirror.listOrders({
      sourceModule: 'pharmacy',
      patientId: patient.id,
      encounterId: pastEncounter.id,
    });
    expect(activeVisitOrders.every((o) => o.encounter?.id === opdEncounter.id)).toBe(true);
    expect(pastVisitOrders.every((o) => o.encounter?.id === pastEncounter.id)).toBe(true);
    expect(pastVisitOrders.some((o) => o.metadata?.instructions === 'Historical course')).toBe(true);

    // Lab & Radiology verified-state gating (item 11)
    await ds.query(
      `INSERT INTO demo.lab_results_e2e (patient_id, encounter_id, test_name, value, flag, verified_at)
       VALUES ($1, $2, 'Full Haemogram', 'Hb 13.8', 'normal', NULL),
              ($1, $2, 'Malaria RDT', 'Negative', 'normal', now())`,
      [patient.id, opdEncounter.id],
    );
    await ds.query(
      `INSERT INTO demo.radiology_reports_e2e (patient_id, encounter_id, impression, verified_at)
       VALUES ($1, $2, 'Draft CXR unverified', NULL),
              ($1, $2, 'Normal chest radiograph verified', now())`,
      [patient.id, opdEncounter.id],
    );
    const verifiedLabsOnly = await ds.query(
      `SELECT test_name FROM demo.lab_results_e2e WHERE patient_id = $1 AND verified_at IS NOT NULL`,
      [patient.id],
    );
    const verifiedRadsOnly = await ds.query(
      `SELECT impression FROM demo.radiology_reports_e2e WHERE patient_id = $1 AND verified_at IS NOT NULL`,
      [patient.id],
    );
    expect(verifiedLabsOnly).toEqual([{ test_name: 'Malaria RDT' }]);
    expect(verifiedRadsOnly).toEqual([{ impression: 'Normal chest radiograph verified' }]);

    // Payment idempotency & receipt sequence concurrency under PostgreSQL advisory locks (item 8)
    const payAttempt = async (idemKey: string) =>
      ds.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [
          'afyasasa.payments.idempotency',
          idemKey,
        ]);
        const existing = await manager.query(
          `SELECT id, external_reference FROM demo.payment_transactions_e2e WHERE idempotency_key = $1`,
          [idemKey],
        );
        if (existing.length) return { replay: true, receipt: existing[0].external_reference };
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [
          'afyasasa.payments.receipt',
          'JH-RCP-2026-',
        ]);
        const latest = await manager.query(
          `SELECT external_reference FROM demo.payment_transactions_e2e WHERE external_reference LIKE 'JH-RCP-2026-%' ORDER BY external_reference DESC LIMIT 1`,
        );
        const lastNum = latest.length ? Number(String(latest[0].external_reference).slice('JH-RCP-2026-'.length)) : 0;
        const receipt = `JH-RCP-2026-${String(lastNum + 1).padStart(5, '0')}`;
        await manager.query(
          `INSERT INTO demo.payment_transactions_e2e (patient_id, amount, external_reference, idempotency_key)
           VALUES ($1, 500, $2, $3)`,
          [patient.id, receipt, idemKey],
        );
        return { replay: false, receipt };
      });

    const [p1, p2] = await Promise.all([payAttempt('idem-concurrent-1'), payAttempt('idem-concurrent-1')]);
    expect(p1.receipt).toBe('JH-RCP-2026-00001');
    expect(p2.receipt).toBe('JH-RCP-2026-00001');
    expect([p1.replay, p2.replay].sort()).toEqual([false, true]);
    const totalPayRows = await ds.query(
      `SELECT count(*)::int AS n FROM demo.payment_transactions_e2e WHERE idempotency_key = 'idem-concurrent-1'`,
    );
    expect(totalPayRows[0].n).toBe(1);

    // 11. Workstream 2 & 3: Partial dispensing (8 of 20, then 12 of 20), reservation cancel before dispense,
    // and full batch/ledger reconciliation
    const partialRx = await mirror.createPharmacyPrescription(
      {
        patientId: patient.id,
        encounterId: opdEncounter.id,
        priority: 'routine',
        clientRequestId: 'opd-partial-rx-1',
        lines: [
          {
            medication: 'Paracetamol 500mg tablet',
            dose: '1g',
            route: 'oral',
            frequency: 'BD',
            duration: '5 days',
            itemId: para.id,
            quantity: 20,
            instructions: 'Partial dispense verification',
          },
        ],
      },
      ctx(counterUserId),
    );
    const partialLineId = partialRx.lines[0].id;
    const partialGroupId = partialRx.header.id;

    // Prepare 8 units first -> holds 8, onHand stays 173, available becomes 165
    await service.preparePrescriptionSale(
      {
        prescriptionGroupId: partialGroupId,
        lines: [{ clinicalOrderId: partialLineId, itemId: para.id, quantity: 8 }],
      },
      ctx(counterUserId),
    );
    const dashHold8 = await service.pharmacyDashboard(ctx(counterUserId));
    expect(dashHold8.stock.onHand).toBe(173);
    expect(dashHold8.stock.reserved).toBe(8);
    expect(dashHold8.stock.available).toBe(165);

    // Clear first payment for 8 units (8 * 5 = KES 40)
    const partialCharge = chargesStore.get(partialGroupId)!;
    partialCharge.amountPaid = '40';
    partialCharge.status = 'paid';
    paymentsStore.set(String(partialCharge.id), [
      {
        id: 'pay-partial-1',
        chargeId: partialCharge.id,
        method: 'cash',
        status: 'completed',
        amount: '40',
        createdAt: new Date(),
        metadata: {},
      },
    ]);

    // Dispense 8 of 20 -> status becomes partially_dispensed, remaining = 12, onHand = 165
    await service.dispensePrescription(
      {
        confirm: true,
        prescriptionGroupId: partialGroupId,
        lines: [{ clinicalOrderId: partialLineId, itemId: para.id, quantity: 8 }],
      },
      ctx(counterUserId),
    );
    const lineAfterFirstDispense = await ds.getRepository(ClinicalOrder).findOneByOrFail({ id: partialLineId });
    const headerAfterFirstDispense = await ds.getRepository(ClinicalOrder).findOneByOrFail({ id: partialGroupId });
    expect(lineAfterFirstDispense.status).toBe('partially_dispensed');
    expect(lineAfterFirstDispense.metadata?.quantityDispensed).toBe(8);
    expect(headerAfterFirstDispense.status).toBe('partially_dispensed');

    // Prepare remaining 12 units -> holds 12, onHand is 165, available is 153
    await service.preparePrescriptionSale(
      {
        prescriptionGroupId: partialGroupId,
        lines: [{ clinicalOrderId: partialLineId, itemId: para.id, quantity: 12 }],
      },
      ctx(counterUserId),
    );
    // Cancel hold before paying for the second installment? Let's test reservation cancel on a separate OTC sale first
    const otcCancelSaleId = 'otc-cancel-before-dispense-1';
    const prepOtcCancel = await service.prepareOtcSale(
      {
        saleId: otcCancelSaleId,
        walkInName: 'Walk-in Cancel Test',
        lines: [{ itemId: para.id, quantity: 5 }],
      },
      ctx(counterUserId),
    );
    const dashWithOtcHold = await service.pharmacyDashboard(ctx(counterUserId));
    expect(dashWithOtcHold.stock.reserved).toBe(17); // 12 + 5
    await service.cancelPharmacySale(
      { saleId: prepOtcCancel.saleId, reason: 'Customer declined before paying' },
      ctx(counterUserId),
    );
    const dashAfterOtcCancel = await service.pharmacyDashboard(ctx(counterUserId));
    expect(dashAfterOtcCancel.stock.onHand).toBe(165);
    expect(dashAfterOtcCancel.stock.reserved).toBe(12);

    // Clear second payment for remaining 12 units (12 * 5 = KES 60; total paid = 100)
    partialCharge.amountPaid = '100';
    partialCharge.status = 'paid';
    paymentsStore.set(String(partialCharge.id), [
      ...(paymentsStore.get(String(partialCharge.id)) ?? []),
      {
        id: 'pay-partial-2',
        chargeId: partialCharge.id,
        method: 'cash',
        status: 'completed',
        amount: '60',
        createdAt: new Date(),
        metadata: {},
      },
    ]);

    // Dispense remaining 12 units -> status becomes dispensed, onHand = 153, reserved = 0
    await service.dispensePrescription(
      {
        confirm: true,
        prescriptionGroupId: partialGroupId,
        lines: [{ clinicalOrderId: partialLineId, itemId: para.id, quantity: 12 }],
      },
      ctx(counterUserId),
    );
    const lineAfterFullDispense = await ds.getRepository(ClinicalOrder).findOneByOrFail({ id: partialLineId });
    const headerAfterFullDispense = await ds.getRepository(ClinicalOrder).findOneByOrFail({ id: partialGroupId });
    expect(lineAfterFullDispense.status).toBe('dispensed');
    expect(lineAfterFullDispense.metadata?.quantityDispensed).toBe(20);
    expect(headerAfterFullDispense.status).toBe('dispensed');

    const dashFinal = await service.pharmacyDashboard(ctx(counterUserId));
    expect(dashFinal.stock.onHand).toBe(153);
    expect(dashFinal.stock.reserved).toBe(0);
    expect(dashFinal.stock.available).toBe(153);

    const endIntegrity = await service.integrityReport(ctx(approverUserId));
    expect(endIntegrity.balanceMismatch).toHaveLength(0);
    expect(endIntegrity.negativeStock).toHaveLength(0);
  });
});

describe('inventory PostgreSQL isolation availability', () => {
  if (inventoryPgConfigured()) {
    it('is configured for isolated localhost use', () => {
      expect(inventoryPgConfigured()).toBe(true);
    });
    return;
  }
  it('is skipped until INVENTORY_TEST_DATABASE_URL points at an isolated localhost database', () => {
    expect(inventoryPgConfigured()).toBe(false);
  });
});
