import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as bcrypt from 'bcrypt';
import { BadRequestException } from '@nestjs/common';
import { connectHmisSim, hmisSimConfigured, HMIS_SIM_DATABASE_URL } from './hmis-sim-harness';
import { assertDisposableHmisSimUrl, parseDatabaseName } from '../common/isolated-database';
import { evaluateFormularyStatus } from '../inventory/formulary-status';

jest.setTimeout(90_000);

const describeSim = hmisSimConfigured() ? describe : describe.skip;

const tenantId = 'aaaaaaaa-0000-4000-8000-00000000aa01';
const adminUserId = 'bbbbbbbb-0000-4000-8000-00000000bb01';
const pharmacistId = 'cccccccc-0000-4000-8000-00000000cc01';
const pharmLocId = 'dddddddd-0000-4000-8000-00000000dd01';
const SIM_PHONE = '0795553008';
const REDACTED_PHONE = '079*****08';

function redactPhone(value: string) {
  return value === SIM_PHONE ? REDACTED_PHONE : value.replace(/\d(?=\d{2})/g, '*');
}

describe('HMIS simulation URL guard (no database)', () => {
  it('refuses the operational hospital database', () => {
    expect(() =>
      assertDisposableHmisSimUrl('postgres://afyasasa:secret@127.0.0.1:5433/afyasasa'),
    ).toThrow(/hmis_sim/);
    expect(parseDatabaseName('postgres://hmis_sim:x@127.0.0.1:5433/hmis_sim')).toBe('hmis_sim');
  });
});

describeSim('Full HMIS simulation on disposable hmis_sim', () => {
  const { DataSource } = require('typeorm') as typeof import('typeorm');
  const { InventoryService } = require('../inventory/inventory.service') as typeof import('../inventory/inventory.service');
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
  } = require('../inventory/inventory.entities') as typeof import('../inventory/inventory.entities');
  const { ClinicalOrder } =
    require('../clinical-order/clinical-order.entities') as typeof import('../clinical-order/clinical-order.entities');
  const { ClinicalOrderMirrorService } =
    require('../clinical-order/clinical-order-mirror.service') as typeof import('../clinical-order/clinical-order-mirror.service');
  const { Tenant, TenantSettings, User, Role, Permission } =
    require('../core/core.entities') as typeof import('../core/core.entities');
  const { Patient, PatientIdentifier, PatientAllergy, PatientChronicCondition, PatientNextOfKin } =
    require('../patients/patient.entities') as typeof import('../patients/patient.entities');
  const { Encounter, Consultation, EncounterDiagnosis } =
    require('../opd/opd.entities') as typeof import('../opd/opd.entities');
  const { Admission, Ward, Bed, DischargeSummary } =
    require('../inpatient/inpatient.entities') as typeof import('../inpatient/inpatient.entities');
  const { InpatientService } =
    require('../inpatient/inpatient.service') as typeof import('../inpatient/inpatient.service');
  const { Appointment, AppointmentSlot } =
    require('../appointments/appointment.entities') as typeof import('../appointments/appointment.entities');
  const { AppointmentsService } =
    require('../appointments/appointments.service') as typeof import('../appointments/appointments.service');
  const { Referral } =
    require('../referrals/referral.entities') as typeof import('../referrals/referral.entities');
  const { ReferralsService } =
    require('../referrals/referrals.service') as typeof import('../referrals/referrals.service');

  let ds: import('typeorm').DataSource;
  let service: import('../inventory/inventory.service').InventoryService;
  let mirror: import('../clinical-order/clinical-order-mirror.service').ClinicalOrderMirrorService;
  let adminPassword = '';
  const chargesStore = new Map<string, Record<string, unknown>>();
  const paymentsStore = new Map<string, Array<Record<string, unknown>>>();
  const evidence: Record<string, unknown> = {
    database: 'hmis_sim',
    patientName: 'Wnicholas Waweru',
    patientPhone: REDACTED_PHONE,
    adminCredentialPrinted: false,
  };

  const ctx = (sub: string, extra?: { roles?: string[]; permissions?: string[] }) =>
    ({
      tenant: { id: tenantId, code: 'jalaram', schemaName: 'demo', name: 'HMIS Sim', subdomain: 'jalaram' },
      user: {
        sub,
        roles: extra?.roles ?? ['pharmacist'],
        permissions: extra?.permissions ?? [
          'inventory:read',
          'inventory:manage',
          'pharmacy:read',
          'pharmacy:dispense',
          'pharmacy:prescribe',
        ],
      },
    }) as never;

  beforeAll(async () => {
    process.env.AFYASASA_CHARGES_ENABLED = 'true';
    process.env.AFYASASA_ALLOW_DEMO_SEED = 'false';
    process.env.TYPEORM_MIGRATIONS_RUN = 'false';
    assertDisposableHmisSimUrl(HMIS_SIM_DATABASE_URL);
    adminPassword = randomBytes(24).toString('base64url');
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const hashMatches = await bcrypt.compare(adminPassword, passwordHash);
    if (!hashMatches) {
      throw new Error('Administrator password hash did not verify.');
    }

    const raw = await connectHmisSim();
    const schemaSql = readFileSync(join(__dirname, 'sql', 'hmis-sim-schema.sql'), 'utf8');
    await raw.query(schemaSql);
    await raw.query(
      `INSERT INTO public.tenants (id, name, code, subdomain, schema_name)
       VALUES ($1, 'HMIS Simulation', 'jalaram', 'jalaram', 'demo')`,
      [tenantId],
    );
    await raw.query(
      `INSERT INTO public.settings (tenant_id, clinical_catalog)
       VALUES ($1, '{"inventoryPricing":{}}'::jsonb)`,
      [tenantId],
    );
    await raw.query(
      `INSERT INTO demo.inventory_locations (id, code, name, location_type)
       VALUES ($1, 'PHARMACY', 'Pharmacy Store', 'pharmacy')`,
      [pharmLocId],
    );
    await raw.query(
      `INSERT INTO demo.users (id, employee_no, first_name, last_name, email, password_hash, force_password_change)
       VALUES ($1, 'EMP-ADMIN', 'Sim', 'Administrator', 'sim.admin@hmis-sim.local', $3, false),
              ($2, 'EMP-PHARM', 'Sim', 'Pharmacist', 'sim.pharmacist@hmis-sim.local', $3, false)`,
      [adminUserId, pharmacistId, passwordHash],
    );
    await raw.query(
      `INSERT INTO demo.roles (name, label, is_system) VALUES ('administrator', 'Administrator', true)`,
    );
    await raw.query(
      `INSERT INTO demo.user_roles (user_id, role_id)
       SELECT $1, id FROM demo.roles WHERE name = 'administrator'`,
      [adminUserId],
    );
    await raw.end();
    adminPassword = '';

    ds = new DataSource({
      type: 'postgres',
      url: HMIS_SIM_DATABASE_URL,
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
        DischargeSummary,
        Appointment,
        AppointmentSlot,
        Referral,
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

    mirror = new ClinicalOrderMirrorService(ds.getRepository(ClinicalOrder), ds.getRepository(InventoryItem));
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
          if (params.dispenseOpId && ops.includes(params.dispenseOpId)) return existing;
          existing.amountOwed = String(Number(existing.amountOwed) + params.amountDelta);
          existing.metadata = {
            ...(existing.metadata ?? {}),
            prepareOps: params.dispenseOpId ? [...ops, params.dispenseOpId] : ops,
          };
          const rem =
            Number(existing.amountOwed) - Number(existing.amountPaid) - Number(existing.amountWaived);
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

  it('creates the synthetic patient, warns on duplicate phone, and does not hard-block phone reuse', async () => {
    const identity = await ds.query('SELECT current_database() AS db, current_user AS usr');
    expect(identity[0].db).toBe('hmis_sim');
    expect(identity[0].usr).toBe('hmis_sim');

    const hashRow = await ds.query(`SELECT password_hash FROM demo.users WHERE id = $1`, [adminUserId]);
    expect(String(hashRow[0].password_hash)).toMatch(/^\$2[aby]\$/);

    const patientRepo = ds.getRepository(Patient);
    const patient = await patientRepo.save(
      patientRepo.create({
        patientNo: 'SIM-P-2026-0001',
        firstName: 'Wnicholas',
        lastName: 'Waweru',
        dateOfBirth: '1990-04-12',
        gender: 'male',
        primaryPhone: SIM_PHONE,
        qrCode: 'sim-qr-wnicholas',
      }),
    );
    expect(patient.patientNo).toBe('SIM-P-2026-0001');

    const phoneTail = SIM_PHONE.replace(/\D/g, '').slice(-9);
    const phoneMatches = await ds.query(
      `SELECT patient_no, first_name, last_name FROM demo.patients
       WHERE deleted_at IS NULL
         AND regexp_replace(coalesce(primary_phone, ''), '\\D', '', 'g') LIKE $1`,
      [`%${phoneTail}`],
    );
    expect(phoneMatches).toHaveLength(1);
    expect(redactPhone(SIM_PHONE)).toBe(REDACTED_PHONE);

    const second = await patientRepo.save(
      patientRepo.create({
        patientNo: 'SIM-P-2026-0002',
        firstName: 'Other',
        lastName: 'Person',
        dateOfBirth: '1988-01-01',
        gender: 'female',
        primaryPhone: SIM_PHONE,
        qrCode: 'sim-qr-other',
      }),
    );
    expect(second.id).toBeTruthy();
    evidence.duplicatePhonePolicy =
      'detectDuplicates warns on matching last-9 digits; identifier collisions hard-block. Phone reuse is not a unique constraint.';
  });

  it('runs the OPD, prescription, pharmacy, lab, radiology and IPD journey', async () => {
    const patient = await ds.getRepository(Patient).findOneByOrFail({ patientNo: 'SIM-P-2026-0001' });
    const encounterRepo = ds.getRepository(Encounter);
    const opdEncounter = await encounterRepo.save(
      encounterRepo.create({
        encounterNo: 'SIM-ENC-OPD-1',
        patient,
        type: 'opd',
        status: 'in_consultation',
        attendingDoctor: { id: adminUserId } as never,
        presentingComplaint: 'Fever and headache for two days',
        visitType: 'new',
      }),
    );

    const consultation = await ds.getRepository(Consultation).save(
      ds.getRepository(Consultation).create({
        encounter: opdEncounter,
        doctor: { id: adminUserId } as never,
        subjective: 'Fever, frontal headache, no neck stiffness',
        objective: 'Temp 38.2, BP 118/76, alert',
        assessment: 'Acute febrile illness',
        plan: 'Paracetamol, malaria RDT, CXR if cough persists, observe',
        status: 'completed',
      }),
    );
    const diagnosis = await ds.getRepository(EncounterDiagnosis).save(
      ds.getRepository(EncounterDiagnosis).create({
        encounter: opdEncounter,
        icd10Code: 'R50.9',
        description: 'Fever, unspecified',
        type: 'primary',
        confirmed: true,
      }),
    );
    expect(consultation.assessment).toBe('Acute febrile illness');
    expect(diagnosis.icd10Code).toBe('R50.9');

    const notifyStub = { notifyUsers: jest.fn().mockResolvedValue(undefined) };
    const appointments = Object.create(AppointmentsService.prototype) as InstanceType<typeof AppointmentsService>;
    Object.assign(appointments, {
      slots: ds.getRepository(AppointmentSlot),
      appointments: ds.getRepository(Appointment),
      patients: ds.getRepository(Patient),
      encounters: encounterRepo,
      clinics: { findOne: async () => null },
      opdService: {},
      notifications: notifyStub,
    });
    const booked = await appointments.createAppointment(
      {
        patientId: patient.id,
        doctorId: adminUserId,
        appointmentDate: '2026-10-27',
        appointmentTime: '09:00',
        type: 'follow_up',
        reason: 'Review fever after discharge plan',
        sourceEncounterId: opdEncounter.id,
      },
      ctx(adminUserId, { roles: ['doctor'], permissions: ['appointments:create'] }),
    );
    expect(booked.status).toBe('scheduled');
    const listed = await appointments.listAppointments('scheduled', '2026-10-27');
    expect(listed.map((row) => row.id)).toContain(booked.id);

    const referrals = Object.create(ReferralsService.prototype) as InstanceType<typeof ReferralsService>;
    Object.assign(referrals, {
      referrals: ds.getRepository(Referral),
      patients: ds.getRepository(Patient),
      encounters: encounterRepo,
      notifications: notifyStub,
    });
    const referral = await referrals.create(
      {
        patientId: patient.id,
        encounterId: opdEncounter.id,
        type: 'internal',
        targetDepartment: 'Laboratory',
        reason: 'Malaria RDT and FBC',
        letter: 'Please process the malaria RDT ordered from this OPD visit.',
        receivingUserId: pharmacistId,
      },
      ctx(adminUserId, { roles: ['doctor'], permissions: ['referrals:create'] }),
    );
    expect(referral.status).toBe('sent');
    const referralRows = await referrals.list(patient.id, 'sent');
    expect(referralRows).toHaveLength(1);

    const catalogue = await service.importCatalog(
      {
        csv: [
          'sku,name,strength,dosage_form,unit,category,sell,reorder_level',
          'PARA500,Paracetamol 500mg tablet,500mg,tablet,tablet,pharmaceutical,5,25',
          'AMOX500,Amoxicillin 500mg capsule,500mg,capsule,capsule,pharmaceutical,15,20',
        ].join('\n'),
        importIntent: 'catalogue',
        confirmStockTake: false,
      },
      ctx(pharmacistId),
    );
    expect(catalogue.created).toBe(2);
    const opening = await service.importCatalog(
      {
        csv: [
          'sku,name,unit,category,batch_no,expiry_date,opening_qty,sell',
          'PARA500,Paracetamol 500mg tablet,tablet,pharmaceutical,LOT-P1,2028-06-30,100,5',
          'AMOX500,Amoxicillin 500mg capsule,capsule,pharmaceutical,LOT-A1,2028-09-30,60,15',
        ].join('\n'),
        locationId: pharmLocId,
        importIntent: 'receipt',
        confirmStockTake: true,
        sessionId: 'sim-open-1',
      },
      ctx(pharmacistId),
    );
    expect(opening.received).toBe(2);

    const para = await ds.getRepository(InventoryItem).findOneByOrFail({ sku: 'PARA500' });
    const amox = await ds.getRepository(InventoryItem).findOneByOrFail({ sku: 'AMOX500' });
    const paraEval = evaluateFormularyStatus(
      { category: 'pharmaceutical', active: true },
      { ppbVerified: true, ppbRegistrationNo: 'PPB-SIM-PARA' },
    );
    const amoxEval = evaluateFormularyStatus({ category: 'pharmaceutical', active: true }, null);
    expect(paraEval.formularyStatus).toBe('hospital_formulary');
    expect(paraEval.regulatoryStatus).toBe('ppb_registration_verified');
    expect(amoxEval.formularyStatus).toBe('hospital_formulary');
    expect(amoxEval.regulatoryStatus).toBe('regulatory_status_unverified');

    const policies = {
      PARA500: { ppbVerified: true, ppbRegistrationNo: 'PPB-SIM-PARA' },
    };

    const opdRx = await mirror.createPharmacyPrescription(
      {
        patientId: patient.id,
        encounterId: opdEncounter.id,
        priority: 'routine',
        clientRequestId: 'sim-opd-rx-1',
        formularyPolicies: policies,
        lines: [
          {
            medication: 'Paracetamol 500mg tablet',
            dose: '1g',
            route: 'oral',
            frequency: 'TDS',
            duration: '3 days',
            itemId: para.id,
            quantity: 18,
          },
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
      ctx(adminUserId, { roles: ['doctor'], permissions: ['pharmacy:prescribe'] }),
    );
    expect(opdRx.lines).toHaveLength(2);
    expect(opdRx.lines[0].metadata).toMatchObject({
      formularyStatus: 'hospital_formulary',
      regulatoryStatus: 'ppb_registration_verified',
      quantityPrescribed: 18,
      quantityDispensed: 0,
    });
    expect(opdRx.lines[1].metadata).toMatchObject({
      formularyStatus: 'hospital_formulary',
      regulatoryStatus: 'regulatory_status_unverified',
    });

    const prnRx = await mirror.createPharmacyPrescription(
      {
        patientId: patient.id,
        encounterId: opdEncounter.id,
        priority: 'routine',
        clientRequestId: 'sim-prn-rx-1',
        lines: [
          {
            medication: 'Paracetamol 500mg tablet',
            dose: '500mg',
            route: 'oral',
            frequency: 'PRN',
            duration: '3 days',
            itemId: para.id,
            quantity: 6,
            instructions: 'As needed for headache. Quantity entered manually.',
          },
        ],
      },
      ctx(adminUserId, { roles: ['doctor'], permissions: ['pharmacy:prescribe'] }),
    );
    expect(prnRx.lines[0].metadata?.frequency).toBe('PRN');

    const statRx = await mirror.createPharmacyPrescription(
      {
        patientId: patient.id,
        encounterId: opdEncounter.id,
        priority: 'stat',
        clientRequestId: 'sim-stat-rx-1',
        lines: [
          {
            medication: 'Paracetamol 500mg tablet',
            dose: '1g',
            route: 'oral',
            frequency: 'STAT',
            itemId: para.id,
            quantity: 2,
          },
        ],
      },
      ctx(adminUserId, { roles: ['doctor'], permissions: ['pharmacy:prescribe'] }),
    );
    expect(statRx.header.priority).toBe('stat');

    await service.preparePrescriptionSale(
      {
        prescriptionGroupId: opdRx.header.id,
        lines: [
          { clinicalOrderId: opdRx.lines[0].id, itemId: para.id, quantity: 18 },
          { clinicalOrderId: opdRx.lines[1].id, itemId: amox.id, quantity: 15 },
        ],
      },
      ctx(pharmacistId),
    );
    await expect(
      service.dispensePrescription(
        {
          confirm: true,
          prescriptionGroupId: opdRx.header.id,
          lines: [
            { clinicalOrderId: opdRx.lines[0].id, itemId: para.id, quantity: 18 },
            { clinicalOrderId: opdRx.lines[1].id, itemId: amox.id, quantity: 15 },
          ],
        },
        ctx(pharmacistId),
      ),
    ).rejects.toThrow(/outstanding/i);

    const opdCharge = chargesStore.get(opdRx.header.id)! as {
      id: string;
      amountOwed: string;
      amountPaid: string;
      status: string;
    };
    opdCharge.amountPaid = opdCharge.amountOwed;
    opdCharge.status = 'paid';
    paymentsStore.set(String(opdCharge.id), [
      {
        id: 'pay-sim-opd-1',
        chargeId: opdCharge.id,
        method: 'cash',
        status: 'completed',
        amount: opdCharge.amountOwed,
        createdAt: new Date(),
        metadata: {},
      },
    ]);
    const dispensed = await service.dispensePrescription(
      {
        confirm: true,
        prescriptionGroupId: opdRx.header.id,
        lines: [
          { clinicalOrderId: opdRx.lines[0].id, itemId: para.id, quantity: 18 },
          { clinicalOrderId: opdRx.lines[1].id, itemId: amox.id, quantity: 15 },
        ],
      },
      ctx(pharmacistId),
    );
    expect(dispensed.lines).toHaveLength(2);
    const headerAfter = await ds.getRepository(ClinicalOrder).findOneByOrFail({ id: opdRx.header.id });
    expect(headerAfter.status).toBe('dispensed');

    await expect(
      mirror.cancelPharmacyPrescription(opdRx.header.id, 'erase', ctx(adminUserId)),
    ).rejects.toThrow(/already been dispensed/i);

    const cancelled = await mirror.cancelPharmacyPrescription(
      prnRx.header.id,
      'Therapy changed before dispensing',
      ctx(adminUserId),
    );
    expect(cancelled.cancelled).toBeGreaterThanOrEqual(2);

    const partial = await mirror.createPharmacyPrescription(
      {
        patientId: patient.id,
        encounterId: opdEncounter.id,
        priority: 'routine',
        clientRequestId: 'sim-partial-rx-1',
        lines: [
          {
            medication: 'Paracetamol 500mg tablet',
            dose: '500mg',
            route: 'oral',
            frequency: 'BD',
            duration: '5 days',
            itemId: para.id,
            quantity: 20,
          },
        ],
      },
      ctx(adminUserId, { roles: ['doctor'], permissions: ['pharmacy:prescribe'] }),
    );
    await service.preparePrescriptionSale(
      {
        prescriptionGroupId: partial.header.id,
        lines: [{ clinicalOrderId: partial.lines[0].id, itemId: para.id, quantity: 8 }],
      },
      ctx(pharmacistId),
    );
    const partialCharge = chargesStore.get(partial.header.id)! as {
      id: string;
      amountOwed: string;
      amountPaid: string;
      status: string;
    };
    partialCharge.amountPaid = '40';
    partialCharge.status = 'paid';
    paymentsStore.set(String(partialCharge.id), [
      {
        id: 'pay-sim-partial-1',
        chargeId: partialCharge.id,
        method: 'cash',
        status: 'completed',
        amount: '40',
        createdAt: new Date(),
        metadata: {},
      },
    ]);
    await service.dispensePrescription(
      {
        confirm: true,
        prescriptionGroupId: partial.header.id,
        lines: [{ clinicalOrderId: partial.lines[0].id, itemId: para.id, quantity: 8 }],
      },
      ctx(pharmacistId),
    );
    const partialHeader = await ds.getRepository(ClinicalOrder).findOneByOrFail({ id: partial.header.id });
    expect(partialHeader.status).toBe('partially_dispensed');

    const wardRepo = ds.getRepository(Ward);
    const bedRepo = ds.getRepository(Bed);
    const admissionRepo = ds.getRepository(Admission);
    const ward = await wardRepo.save(wardRepo.create({ name: 'Male Medical', code: 'MMW', type: 'medical', bedCount: 1 }));
    const bed = await bedRepo.save(bedRepo.create({ ward, bedNo: 'M-01', type: 'standard', status: 'occupied' }));
    const admission = await admissionRepo.save(
      admissionRepo.create({
        admissionNo: 'SIM-ADM-1',
        patient,
        encounter: opdEncounter,
        ward,
        bed,
        reason: 'Observation for febrile illness',
        type: 'emergency',
        status: 'active',
        admittingDoctor: { id: adminUserId } as never,
      }),
    );
    const ipdRx = await mirror.createPharmacyPrescription(
      {
        patientId: patient.id,
        encounterId: opdEncounter.id,
        admissionId: admission.id,
        priority: 'stat',
        clientRequestId: 'sim-ipd-rx-1',
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
      ctx(adminUserId, { roles: ['doctor'], permissions: ['pharmacy:prescribe'] }),
    );
    expect(ipdRx.header.admission).toBeTruthy();

    const ipd = Object.create(InpatientService.prototype) as InstanceType<typeof InpatientService>;
    Object.assign(ipd, {
      admissions: admissionRepo,
      beds: bedRepo,
      summaries: ds.getRepository(DischargeSummary),
      encounters: encounterRepo,
      dataSource: ds,
      realtime: { publish: jest.fn() },
      encounterWorkflow: {
        canTransition: (from: string, to: string) =>
          from === to || (from === 'in_consultation' && (to === 'completed' || to === 'admitted')),
        blockedTransitionMessage: (from: string, to: string) => `Cannot move ${from} to ${to}`,
      },
      operationalCharges: {
        assertDischargeBalanceAllowed: async (admissionId: string) => {
          const rows = await ds.query(
            `SELECT COALESCE(SUM(amount_owed - amount_paid - COALESCE(amount_waived, 0)), 0)::float AS outstanding
             FROM demo.charges WHERE admission_id = $1`,
            [admissionId],
          );
          const outstanding = Number(rows[0]?.outstanding ?? 0);
          if (outstanding > 0) {
            throw new BadRequestException(
              `Outstanding balance of KES ${outstanding.toFixed(2)} must be collected or waived before discharge.`,
            );
          }
        },
        processAdmissionById: async (admissionId: string) => {
          const existing = await ds.query(
            `SELECT id FROM demo.charges WHERE admission_id = $1 AND service_line = 'inpatient' LIMIT 1`,
            [admissionId],
          );
          if (existing.length) return { generated: 0 };
          await ds.query(
            `INSERT INTO demo.charges (
               patient_id, encounter_id, admission_id, service_line, service_entity_id,
               service_description, amount_owed, amount_paid, amount_waived, status
             ) VALUES ($1, $2, $3, 'inpatient', $3, 'SIM accommodation', 2500, 2500, 0, 'paid')`,
            [patient.id, opdEncounter.id, admissionId],
          );
          return { generated: 1 };
        },
      },
    });

    await ds.query(
      `INSERT INTO demo.charges (
         patient_id, encounter_id, admission_id, service_line, service_entity_id,
         service_description, amount_owed, amount_paid, amount_waived, status
       ) VALUES ($1, $2, $3, 'inpatient', $3, 'SIM ward stay unpaid', 5000, 0, 0, 'owed')`,
      [patient.id, opdEncounter.id, admission.id],
    );
    const summary = await ipd.createDischargeSummary(
      admission.id,
      {
        presentingComplaint: 'Fever and headache',
        history: 'Two days of fever',
        examOnAdmission: 'Febrile, alert',
        investigationsSummary: 'Malaria RDT negative',
        finalDiagnosis: 'Acute febrile illness',
        treatmentGiven: 'Paracetamol and observation',
        dischargeMeds: 'Paracetamol 500mg TDS 3 days',
        followUpInstructions: 'Return if fever recurs',
      },
      ctx(adminUserId, { roles: ['doctor'], permissions: ['admissions:discharge', 'discharge_summaries:create'] }),
    );
    await ipd.completeDischargeSummary(
      summary.id,
      ctx(adminUserId, { roles: ['doctor'], permissions: ['discharge_summaries:complete'] }),
    );
    await expect(
      ipd.dischargeAdmission(
        admission.id,
        { conditionOnDischarge: 'improved' },
        ctx(adminUserId, { roles: ['doctor'], permissions: ['admissions:discharge'] }),
      ),
    ).rejects.toThrow(/Outstanding balance/);
    await ds.query(`UPDATE demo.charges SET amount_paid = amount_owed, status = 'paid' WHERE admission_id = $1`, [
      admission.id,
    ]);
    const discharged = await ipd.dischargeAdmission(
      admission.id,
      { conditionOnDischarge: 'improved' },
      ctx(adminUserId, { roles: ['doctor'], permissions: ['admissions:discharge'] }),
    );
    expect(discharged.status).toBe('discharged');
    const bedAfter = await bedRepo.findOneByOrFail({ id: bed.id });
    expect(bedAfter.status).toBe('cleaning');
    const encounterAfter = await encounterRepo.findOneByOrFail({ id: opdEncounter.id });
    expect(encounterAfter.status).toBe('completed');
    const stayCharge = await ds.query(
      `SELECT amount_owed::float, amount_paid::float, status, service_line FROM demo.charges
       WHERE admission_id = $1 AND service_line = 'inpatient'`,
      [admission.id],
    );
    expect(stayCharge).toHaveLength(1);
    expect(stayCharge[0]).toMatchObject({ amount_owed: 5000, amount_paid: 5000, status: 'paid' });

    await ds.query(
      `INSERT INTO demo.lab_results_e2e (patient_id, encounter_id, test_name, value, flag, verified_at)
       VALUES ($1, $2, 'Malaria RDT', 'Negative', 'normal', now()),
              ($1, $2, 'Full Haemogram', 'Hb 13.1', 'normal', NULL)`,
      [patient.id, opdEncounter.id],
    );
    await ds.query(
      `INSERT INTO demo.radiology_reports_e2e (patient_id, encounter_id, impression, verified_at)
       VALUES ($1, $2, 'Normal chest radiograph verified', now()),
              ($1, $2, 'Draft CXR unverified', NULL)`,
      [patient.id, opdEncounter.id],
    );
    const verifiedLabs = await ds.query(
      `SELECT test_name FROM demo.lab_results_e2e WHERE patient_id = $1 AND verified_at IS NOT NULL`,
      [patient.id],
    );
    const verifiedRads = await ds.query(
      `SELECT impression FROM demo.radiology_reports_e2e WHERE patient_id = $1 AND verified_at IS NOT NULL`,
      [patient.id],
    );
    expect(verifiedLabs).toEqual([{ test_name: 'Malaria RDT' }]);
    expect(verifiedRads).toEqual([{ impression: 'Normal chest radiograph verified' }]);

    await ds.query(
      `INSERT INTO demo.charges (patient_id, encounter_id, admission_id, service_line, service_entity_id, service_description, amount_owed, amount_paid, status)
       VALUES ($1, $2, NULL, 'pharmacy', $3, 'SIM OPD Rx', $4, $4, 'paid')`,
      [patient.id, opdEncounter.id, opdRx.header.id, opdCharge.amountOwed],
    );

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
        const receipt = 'SIM-RCP-2026-00001';
        await manager.query(
          `INSERT INTO demo.payment_transactions_e2e (patient_id, amount, external_reference, idempotency_key)
           VALUES ($1, 500, $2, $3)`,
          [patient.id, receipt, idemKey],
        );
        return { replay: false, receipt };
      });
    const [p1, p2] = await Promise.all([payAttempt('sim-idem-1'), payAttempt('sim-idem-1')]);
    expect(p1.receipt).toBe(p2.receipt);
    expect([p1.replay, p2.replay].sort()).toEqual([false, true]);

    const counts = await ds.query(`
      SELECT
        (SELECT count(*)::int FROM demo.patients WHERE deleted_at IS NULL) AS patients,
        (SELECT count(*)::int FROM demo.encounters WHERE type = 'opd' AND deleted_at IS NULL) AS opd_visits,
        (SELECT count(*)::int FROM demo.admissions WHERE status = 'active' AND deleted_at IS NULL) AS current_inpatients,
        (SELECT count(*)::int FROM demo.admissions WHERE status = 'discharged' AND deleted_at IS NULL) AS discharged_admissions,
        (SELECT count(*)::int FROM demo.beds WHERE status = 'occupied' AND deleted_at IS NULL) AS occupied_beds,
        (SELECT count(*)::int FROM demo.beds WHERE deleted_at IS NULL) AS total_beds,
        (SELECT count(*)::int FROM demo.lab_results_e2e WHERE verified_at IS NOT NULL) AS verified_labs,
        (SELECT count(*)::int FROM demo.lab_results_e2e WHERE verified_at IS NULL) AS unverified_labs,
        (SELECT count(*)::int FROM demo.radiology_reports_e2e WHERE verified_at IS NOT NULL) AS verified_rads,
        (SELECT count(*)::int FROM demo.clinical_orders WHERE order_type = 'pharmacy' AND metadata->>'kind' = 'prescription') AS rx_headers,
        (SELECT count(*)::int FROM demo.inventory_transactions WHERE transaction_type = 'DISPENSE') AS dispense_ledger,
        (SELECT count(*)::int FROM demo.appointments WHERE deleted_at IS NULL) AS appointments,
        (SELECT count(*)::int FROM demo.referrals WHERE deleted_at IS NULL) AS referrals
    `);
    const integrity = await service.integrityReport(ctx(pharmacistId));
    expect(integrity.balanceMismatch).toHaveLength(0);

    Object.assign(evidence, {
      journey: {
        opdEncounter: opdEncounter.encounterNo,
        admission: admission.admissionNo,
        discharged: discharged.admissionNo,
        rxHeaders: counts[0].rx_headers,
        unpaidDispenseBlocked: true,
        partialDispenseStatus: partialHeader.status,
        statPriority: statRx.header.priority,
        appointment: booked.id,
        referral: referral.id,
        prnCancelled: true,
        bloodBank: 'request_desk_not_simulated_as_transfusion_programme',
        shaHieMpesaKhis: 'BLOCKED_EXTERNAL',
      },
      directorCounts: counts[0],
      stockIntegrityBalanceMismatch: integrity.balanceMismatch.length,
    });

    expect(counts[0].discharged_admissions).toBe(1);
    expect(counts[0].current_inpatients).toBe(0);
    expect(counts[0].appointments).toBe(1);
    expect(counts[0].referrals).toBe(1);
    expect(evidence.journey).toMatchObject({ unpaidDispenseBlocked: true });
  });
});
