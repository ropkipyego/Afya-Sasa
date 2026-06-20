import { Injectable } from '@nestjs/common';

@Injectable()
export class RbacService {
  readonly defaultRoles = [
    'administrator',
    'doctor',
    'nurse',
    'lab_technician',
    'radiology_technician',
    'records_officer',
  ] as const;

  readonly phaseOnePermissions = [
    'auth:change_password',
    'patients:create',
    'patients:read',
    'patients:update',
    'patients:delete',
    'patients:search',
    'patients:history',
    'patient_identifiers:manage',
    'patient_allergies:manage',
    'patient_chronic_conditions:manage',
    'patient_next_of_kin:manage',
    'users:manage',
    'roles:manage',
    'audit_logs:read',
    'settings:manage',
  ] as const;
}
