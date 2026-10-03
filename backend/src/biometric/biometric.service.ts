import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { In, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { Appointment } from '../appointments/appointment.entities';
import { AuditService } from '../core/audit/audit.service';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient, PatientAllergy } from '../patients/patient.entities';
import {
  BiometricDevice,
  BiometricIdentity,
  BiometricVerification,
} from './biometric.entities';
import {
  DeviceHeartbeatDto,
  EnrollBiometricDto,
  IdentifyBiometricDto,
  RegisterBiometricDeviceDto,
  VerifyBiometricDto,
} from './biometric.dto';
import type { BiometricAgentPayload } from './providers/biometric-provider.interface';
import { DigitalPersonaProvider } from './providers/digitalpersona.provider';

const RECENT_NONCE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class BiometricService {
  private readonly usedNonces = new Map<string, number>();

  constructor(
    @InjectRepository(BiometricDevice)
    private readonly devices: Repository<BiometricDevice>,
    @InjectRepository(BiometricIdentity)
    private readonly identities: Repository<BiometricIdentity>,
    @InjectRepository(BiometricVerification)
    private readonly verifications: Repository<BiometricVerification>,
    @InjectRepository(Patient)
    private readonly patients: Repository<Patient>,
    @InjectRepository(Encounter)
    private readonly encounters: Repository<Encounter>,
    @InjectRepository(Admission)
    private readonly admissions: Repository<Admission>,
    @InjectRepository(Appointment)
    private readonly appointments: Repository<Appointment>,
    @InjectRepository(PatientAllergy)
    private readonly allergies: Repository<PatientAllergy>,
    private readonly provider: DigitalPersonaProvider,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  status() {
    return {
      provider: this.provider.providerId,
      device: 'HID DigitalPersona 4500',
      localMatching: true,
      dhaConsentIntegrated: false,
      storesRawImages: false,
      templateStorage:
        this.config.get<string>('BIOMETRIC_TEMPLATE_KEY')?.trim()
          ? 'encrypted_optional'
          : 'external_subject_id_only',
      fallback:
        'Manual patient number / national ID search remains available if the reader or agent is offline.',
    };
  }

  async listDevices() {
    const rows = await this.safeFindDevices();
    return rows.map((device) => this.toPublicDevice(device));
  }

  async registerDevice(dto: RegisterBiometricDeviceDto, request: RequestContext) {
    const deviceKey = (dto.deviceKey ?? `dp4500-${randomBytes(4).toString('hex')}`).trim();
    const existing = await this.devices.findOne({ where: { deviceKey } });
    if (existing) throw new ConflictException('A device with this key already exists');
    const secret = randomBytes(24).toString('hex');
    const saved = await this.devices.save(
      this.devices.create({
        deviceKey,
        name: dto.name.trim(),
        provider: this.provider.providerId,
        location: dto.location?.trim() || null,
        status: 'pending',
        secretHash: this.hashSecret(secret),
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    await this.auditAction(request, 'BIOMETRIC_DEVICE_ENABLED', saved.id, {
      deviceKey,
      location: saved.location,
    });
    return { ...this.toPublicDevice(saved), deviceSecret: secret };
  }

  async setDeviceEnabled(id: string, enabled: boolean, request: RequestContext) {
    const device = await this.devices.findOne({ where: { id } });
    if (!device) throw new NotFoundException('Biometric device not found');
    device.status = enabled ? 'offline' : 'disabled';
    device.updatedBy = request.user?.sub ?? null;
    await this.devices.save(device);
    await this.auditAction(
      request,
      enabled ? 'BIOMETRIC_DEVICE_ENABLED' : 'BIOMETRIC_DEVICE_DISABLED',
      device.id,
      { deviceKey: device.deviceKey },
    );
    return this.toPublicDevice(device);
  }

  async heartbeat(dto: DeviceHeartbeatDto) {
    const device = await this.authenticateDevice(dto.deviceKey, dto.deviceSecret);
    const readerState = dto.readerState;
    const ready = readerState === 'DEVICE_READY' && dto.status !== 'offline';
    device.status = ready ? 'online' : dto.status === 'offline' || readerState ? 'offline' : 'online';
    if (readerState === 'SDK_UNAVAILABLE' || readerState === 'DEVICE_DISCONNECTED' || readerState === 'ERROR') {
      device.status = 'offline';
    }
    device.agentVersion = dto.agentVersion ?? device.agentVersion;
    device.lastHeartbeatAt = new Date();
    device.lastError =
      dto.lastError ??
      (readerState && readerState !== 'DEVICE_READY' ? readerState : null);
    if (dto.status === 'offline') {
      device.lastError = dto.lastError || readerState || 'Agent reported offline';
    }
    await this.devices.save(device);
    return this.toPublicDevice(device);
  }

  async enroll(dto: EnrollBiometricDto, request: RequestContext) {
    this.assertOperator(request, 'enroll');
    const patient = await this.patients.findOne({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException('Patient not found');
    const capture = this.provider.validatePayload(dto.capture);
    const device = await this.authenticateCapture(capture);
    this.consumeNonce(capture.nonce);

    if (capture.result !== 'enrolled' && capture.result !== 'verified') {
      await this.recordVerification({
        request,
        patient,
        device,
        purpose: 'enroll',
        result: capture.result,
        capture,
      });
      await this.auditDeviceFailure(request, device.id, capture, 'enroll');
      throw new BadRequestException(this.captureFailureMessage(capture, 'enroll'));
    }
    if (capture.qualityLabel && /poor|low|reject/i.test(capture.qualityLabel)) {
      await this.recordVerification({
        request,
        patient,
        device,
        purpose: 'enroll',
        result: 'not_verified',
        capture,
      });
      throw new BadRequestException(
        'Fingerprint quality is too low. Please reposition the finger and try again.',
      );
    }

    const subject = capture.externalSubjectId?.trim();
    if (!subject) {
      throw new BadRequestException('The agent did not return an external biometric subject id');
    }

    const existingSubject = await this.identities.findOne({
      where: { provider: this.provider.providerId, externalSubjectId: subject, status: 'active' },
      relations: { patient: true },
    });
    if (existingSubject && existingSubject.patient.id !== patient.id) {
      await this.recordVerification({
        request,
        patient,
        device,
        purpose: 'enroll',
        result: 'not_verified',
        capture,
      });
      await this.auditAction(request, 'BIOMETRIC_CONFLICT', patient.id, {
        deviceId: device.id,
        existingPatientId: existingSubject.patient.id,
        reason: 'fingerprint_already_linked',
      });
      throw new ConflictException(
        'This fingerprint is already registered to another patient. An administrator must resolve the duplicate. Patients were not merged.',
      );
    }

    const fingerPosition = dto.fingerPosition ?? capture.fingerPosition ?? null;
    if (existingSubject && existingSubject.patient.id === patient.id) {
      if (fingerPosition && !existingSubject.fingerPosition) {
        existingSubject.fingerPosition = fingerPosition;
        existingSubject.updatedBy = request.user?.sub ?? null;
        await this.identities.save(existingSubject);
      }
    }

    const identity =
      existingSubject ??
      (await this.identities.save(
        this.identities.create({
          patient,
          provider: this.provider.providerId,
          deviceId: device.id,
          externalSubjectId: subject,
          fingerPosition,
          status: 'active',
          createdBy: request.user?.sub ?? null,
          updatedBy: request.user?.sub ?? null,
        }),
      ));

    device.lastSuccessAt = new Date();
    await this.devices.save(device);
    await this.recordVerification({
      request,
      patient,
      device,
      identity,
      purpose: 'enroll',
      result: 'enrolled',
      capture,
    });
    await this.auditAction(request, 'BIOMETRIC_ENROLL', patient.id, {
      deviceId: device.id,
      identityId: identity.id,
      fingerPosition: identity.fingerPosition,
      qualityLabel: capture.qualityLabel ?? null,
      externalReference: capture.externalReference ?? null,
    });
    return {
      result: 'enrolled' as const,
      patientId: patient.id,
      patientNo: patient.patientNo,
      identityId: identity.id,
      fingerPosition: identity.fingerPosition,
      qualityLabel: capture.qualityLabel ?? null,
    };
  }

  async verify(dto: VerifyBiometricDto, request: RequestContext) {
    this.assertOperator(request, 'verify');
    const patient = await this.patients.findOne({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException('Patient not found');
    const capture = this.provider.validatePayload(dto.capture);
    const device = await this.authenticateCapture(capture);
    this.consumeNonce(capture.nonce);

    if (capture.result === 'device_error' || capture.result === 'timeout' || capture.result === 'cancelled') {
      await this.auditDeviceFailure(request, device.id, capture, 'verify');
      throw new BadRequestException(this.captureFailureMessage(capture, 'verify'));
    }

    const identities = await this.identities.find({
      where: {
        patient: { id: patient.id },
        provider: this.provider.providerId,
        status: 'active',
      },
    });
    if (!identities.length) {
      throw new NotFoundException('No biometric identity is registered for this patient');
    }

    const matchedIdentity = identities.find(
      (row) => row.externalSubjectId && row.externalSubjectId === capture.externalSubjectId,
    );
    let result = capture.result;
    if (result === 'verified' && capture.externalSubjectId && !matchedIdentity) {
      result = 'not_verified';
    }
    const identity = matchedIdentity ?? identities[0];

    await this.recordVerification({
      request,
      patient,
      device,
      identity,
      purpose: 'verify',
      result,
      capture,
    });
    await this.auditAction(
      request,
      result === 'verified' ? 'BIOMETRIC_VERIFY_SUCCESS' : 'BIOMETRIC_VERIFY_FAILED',
      patient.id,
      { deviceId: device.id, result, externalReference: capture.externalReference ?? null },
    );
    if (result === 'verified') {
      device.lastSuccessAt = new Date();
      await this.devices.save(device);
    }
    return {
      result,
      patientId: patient.id,
      patientNo: patient.patientNo,
      matched: result === 'verified',
      message:
        result === 'verified'
          ? 'Fingerprint verified'
          : 'Fingerprint does not match this patient.',
      fallback:
        result !== 'verified'
          ? 'Use patient number or national ID. Do not block emergency care.'
          : undefined,
    };
  }

  async identify(dto: IdentifyBiometricDto, request: RequestContext) {
    this.assertOperator(request, 'identify');
    const capture = this.provider.validatePayload(dto.capture);
    const device = await this.authenticateCapture(capture);
    this.consumeNonce(capture.nonce);

    if (capture.result === 'device_error' || capture.result === 'timeout' || capture.result === 'cancelled') {
      await this.auditDeviceFailure(request, device.id, capture, 'identify');
      throw new BadRequestException(this.captureFailureMessage(capture, 'identify'));
    }

    if (capture.result === 'no_match' || capture.result === 'not_verified') {
      await this.recordVerification({
        request,
        device,
        purpose: 'identify',
        result: 'no_match',
        capture,
      });
      await this.auditAction(request, 'BIOMETRIC_IDENTIFY', null, {
        result: 'no_match',
        deviceId: device.id,
      });
      return {
        result: 'no_match' as const,
        patients: [],
        context: null,
        message: 'Patient fingerprint not recognized. Continue with manual identification. Do not create a patient from this scan.',
      };
    }

    const subjectIds = [
      capture.externalSubjectId,
      ...(capture.candidates ?? []).map((row) => row.externalSubjectId),
    ].filter((value): value is string => Boolean(value?.trim()));

    const matches: Patient[] = [];
    for (const subject of [...new Set(subjectIds)]) {
      const identity = await this.identities.findOne({
        where: { provider: this.provider.providerId, externalSubjectId: subject, status: 'active' },
        relations: { patient: true },
      });
      if (identity?.patient && !matches.some((row) => row.id === identity.patient.id)) {
        matches.push(identity.patient);
      }
    }

    const result =
      matches.length > 1 ? 'multiple_candidates' : matches.length === 1 ? 'verified' : 'no_match';
    await this.recordVerification({
      request,
      patient: matches.length === 1 ? matches[0] : null,
      device,
      purpose: 'identify',
      result,
      capture,
    });
    await this.auditAction(request, 'BIOMETRIC_IDENTIFY', matches[0]?.id ?? null, {
      result,
      deviceId: device.id,
      candidateCount: matches.length,
    });
    if (result === 'verified') {
      device.lastSuccessAt = new Date();
      await this.devices.save(device);
    }
    return {
      result,
      patients: matches.map((patient) => this.toPublicPatient(patient)),
      context: result === 'verified' ? await this.patientContext(matches[0].id) : null,
      message:
        result === 'multiple_candidates'
          ? 'Multiple biometric candidates were returned. Confirm identity with another factor. No patient was selected.'
          : result === 'no_match'
            ? 'Patient fingerprint not recognized. Continue with manual identification.'
            : undefined,
    };
  }

  async listIdentities(patientId: string, request: RequestContext) {
    this.assertOperator(request, 'verify');
    const patient = await this.patients.findOne({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Patient not found');
    const rows = await this.identities.find({
      where: { patient: { id: patientId }, status: 'active' },
      order: { createdAt: 'ASC' },
    });
    return {
      patient: this.toPublicPatient(patient),
      identities: rows.map((row) => ({
        id: row.id,
        fingerPosition: row.fingerPosition,
        status: row.status,
        createdAt: row.createdAt,
      })),
    };
  }

  async patientContext(patientId: string) {
    const [openEncounter, lastEncounter, activeAdmission, upcomingAppointment, allergyRows] =
      await Promise.all([
        this.encounters.findOne({
          where: {
            patient: { id: patientId },
            status: In(['registered', 'triaged', 'in_consultation', 'awaiting_results', 'admitted']),
          },
          order: { startedAt: 'DESC' },
        }),
        this.encounters.findOne({
          where: { patient: { id: patientId } },
          order: { startedAt: 'DESC' },
        }),
        this.admissions.findOne({
          where: { patient: { id: patientId }, status: 'active' },
          order: { admittedAt: 'DESC' },
        }),
        this.appointments.findOne({
          where: { patient: { id: patientId }, status: In(['scheduled', 'confirmed', 'arrived']) },
          order: { appointmentDate: 'ASC', appointmentTime: 'ASC' },
        }),
        this.allergies.find({
          where: { patient: { id: patientId } },
          take: 8,
          order: { createdAt: 'DESC' },
        }),
      ]);
    return {
      currentEncounter: openEncounter
        ? {
            id: openEncounter.id,
            status: openEncounter.status,
            type: openEncounter.type,
            startedAt: openEncounter.startedAt,
          }
        : null,
      lastVisitAt: lastEncounter?.startedAt ?? null,
      currentAdmission: activeAdmission
        ? {
            id: activeAdmission.id,
            status: activeAdmission.status,
            admittedAt: activeAdmission.admittedAt,
          }
        : null,
      upcomingAppointment: upcomingAppointment
        ? {
            id: upcomingAppointment.id,
            status: upcomingAppointment.status,
            date: upcomingAppointment.appointmentDate,
            time: upcomingAppointment.appointmentTime,
            type: upcomingAppointment.type,
          }
        : null,
      alerts: allergyRows.map((row) => ({
        kind: 'allergy' as const,
        label: row.allergen,
        severity: row.severity,
      })),
    };
  }

  async unlink(identityId: string, request: RequestContext) {
    this.assertOperator(request, 'unlink');
    const identity = await this.identities.findOne({
      where: { id: identityId },
      relations: { patient: true },
    });
    if (!identity) throw new NotFoundException('Biometric identity not found');
    identity.status = 'unlinked';
    identity.updatedBy = request.user?.sub ?? null;
    await this.identities.save(identity);
    await this.auditAction(request, 'BIOMETRIC_UNLINK', identity.patient.id, {
      identityId,
      fingerPosition: identity.fingerPosition,
    });
    return {
      result: 'unlinked' as const,
      patientId: identity.patient.id,
      patientNo: identity.patient.patientNo,
      patientName: `${identity.patient.firstName} ${identity.patient.lastName}`.trim(),
    };
  }

  private assertOperator(
    request: RequestContext,
    action: 'enroll' | 'verify' | 'identify' | 'unlink',
  ) {
    const roles = request.user?.roles ?? [];
    const permissions = request.user?.permissions ?? [];
    const admin =
      roles.includes('administrator') ||
      roles.includes('superadmin') ||
      permissions.includes('settings:manage');
    if (action === 'unlink' && !admin) {
      throw new ForbiddenException('Only an administrator can unlink a biometric identity');
    }
    if (action === 'enroll') {
      const allowed =
        admin ||
        roles.includes('records_officer') ||
        permissions.includes('patients:create') ||
        permissions.includes('patients:update');
      if (!allowed) {
        throw new ForbiddenException('Enrollment requires reception or administrator permission');
      }
      return;
    }
    const allowed =
      admin ||
      roles.includes('records_officer') ||
      roles.includes('nurse') ||
      permissions.includes('patients:search') ||
      permissions.includes('patients:read');
    if (!allowed) {
      throw new ForbiddenException('Biometric verification is not permitted for this role');
    }
  }

  private async authenticateCapture(capture: BiometricAgentPayload) {
    if (capture.deviceSecret) {
      return this.authenticateDevice(capture.deviceKey, capture.deviceSecret);
    }
    const device = await this.devices.findOne({ where: { deviceKey: capture.deviceKey } });
    if (!device) throw new UnauthorizedException('Unknown biometric workstation');
    if (device.status === 'disabled') {
      throw new ForbiddenException('This biometric workstation is disabled');
    }
    if (!capture.deviceHmac || !capture.nonce || !capture.capturedAt) {
      throw new UnauthorizedException('Workstation HMAC, nonce, and capture time are required');
    }
    const expected = createHash('sha256')
      .update(`${device.secretHash}:${capture.nonce}:${capture.capturedAt}`)
      .digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(capture.deviceHmac);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid biometric workstation signature');
    }
    return device;
  }

  private async authenticateDevice(deviceKey: string, secret: string) {
    const device = await this.devices.findOne({ where: { deviceKey } });
    if (!device) throw new UnauthorizedException('Unknown biometric workstation');
    if (device.status === 'disabled') {
      throw new ForbiddenException('This biometric workstation is disabled');
    }
    const expected = Buffer.from(device.secretHash);
    const actual = Buffer.from(this.hashSecret(secret));
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException('Invalid biometric workstation secret');
    }
    return device;
  }

  private consumeNonce(nonce?: string) {
    this.pruneNonces();
    if (!nonce?.trim()) {
      throw new BadRequestException('Capture nonce is required to prevent replay');
    }
    if (this.usedNonces.has(nonce)) {
      throw new BadRequestException('This biometric capture was already used');
    }
    this.usedNonces.set(nonce, Date.now());
  }

  private pruneNonces() {
    const cutoff = Date.now() - RECENT_NONCE_TTL_MS;
    for (const [nonce, at] of this.usedNonces) {
      if (at < cutoff) this.usedNonces.delete(nonce);
    }
  }

  private hashSecret(secret: string) {
    return createHash('sha256').update(secret).digest('hex');
  }

  private captureFailureMessage(
    capture: BiometricAgentPayload,
    operation: 'enroll' | 'verify' | 'identify',
  ) {
    const error = (capture.lastError || capture.readerState || '').toUpperCase();
    if (error.includes('SDK_UNAVAILABLE')) {
      return 'DigitalPersona SDK is not available on this workstation.';
    }
    if (error.includes('DEVICE_DISCONNECTED') || capture.result === 'device_error') {
      return 'Fingerprint reader unavailable. Use manual patient search.';
    }
    if (capture.result === 'timeout') {
      return 'Fingerprint capture timed out. Reposition the finger and try again.';
    }
    if (capture.result === 'cancelled') {
      return 'Fingerprint capture was cancelled.';
    }
    if (capture.qualityLabel && /poor|low|reject/i.test(capture.qualityLabel)) {
      return 'Fingerprint quality is too low. Please reposition the finger and try again.';
    }
    return operation === 'enroll'
      ? 'Fingerprint enrollment was not completed.'
      : 'Fingerprint capture was not completed.';
  }

  private toPublicPatient(patient: Patient) {
    return {
      id: patient.id,
      patientNo: patient.patientNo,
      firstName: patient.firstName,
      middleName: patient.middleName ?? null,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
      primaryPhone: patient.primaryPhone,
      createdAt: patient.createdAt,
      photoUrl: patient.photoUrl ?? null,
    };
  }

  private async auditDeviceFailure(
    request: RequestContext,
    deviceId: string,
    capture: BiometricAgentPayload,
    operation: 'enroll' | 'verify' | 'identify',
  ) {
    await this.auditAction(request, 'BIOMETRIC_DEVICE_ERROR', null, {
      deviceId,
      operation,
      result: capture.result,
      readerState: capture.readerState ?? null,
      reason: capture.lastError ?? capture.readerState ?? capture.result,
    });
  }

  private toPublicDevice(device: BiometricDevice) {
    return {
      id: device.id,
      deviceKey: device.deviceKey,
      name: device.name,
      provider: device.provider,
      location: device.location,
      status: device.status,
      agentVersion: device.agentVersion,
      lastHeartbeatAt: device.lastHeartbeatAt,
      lastSuccessAt: device.lastSuccessAt,
      lastError: device.lastError,
    };
  }

  private async recordVerification(input: {
    request: RequestContext;
    patient?: Patient | null;
    device: BiometricDevice;
    identity?: BiometricIdentity;
    purpose: BiometricVerification['purpose'];
    result: BiometricVerification['result'];
    capture: BiometricAgentPayload;
  }) {
    await this.verifications.save(
      this.verifications.create({
        patient: input.patient ?? null,
        biometricIdentity: input.identity ?? null,
        deviceId: input.device.id,
        provider: this.provider.providerId,
        operator: input.request.user?.sub ? ({ id: input.request.user.sub } as never) : null,
        purpose: input.purpose,
        result: input.result,
        confidence: input.capture.confidence != null ? String(input.capture.confidence) : null,
        externalReference: input.capture.externalReference ?? null,
        correlationId: input.request.header?.('x-request-id') ?? input.capture.nonce ?? null,
        createdBy: input.request.user?.sub ?? null,
        updatedBy: input.request.user?.sub ?? null,
      }),
    );
  }

  private async auditAction(
    request: RequestContext,
    action: string,
    recordId: string | null,
    afterJson: Record<string, unknown>,
  ) {
    await this.audit.record({
      userId: request.user?.sub ?? null,
      action,
      recordType: 'biometric',
      recordId,
      afterJson,
      ip: request.ip ?? null,
      userAgent: typeof request.headers?.['user-agent'] === 'string' ? request.headers['user-agent'] : null,
      sessionId: request.user?.sid ?? null,
      endpoint: request.originalUrl ?? '/biometrics',
      httpCode: 200,
      durationMs: 0,
    });
  }

  private async safeFindDevices() {
    try {
      return await this.devices.find({ order: { name: 'ASC' } });
    } catch {
      throw new ServiceUnavailableException(
        'Biometric tables are not applied on this database yet. Review the additive migration before enabling devices.',
      );
    }
  }
}
