import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  Unique,
} from 'typeorm';
import { AuditableEntity } from '../common/auditable.entity';

@Entity({ name: 'tenants', schema: 'public' })
@Unique(['code'])
@Unique(['subdomain'])
export class Tenant extends AuditableEntity {
  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  code!: string;

  @Column({ type: 'varchar',  name: 'schema_name' })
  schemaName!: string;

  @Column({ type: 'varchar' })
  subdomain!: string;

  @Column({ type: 'varchar',  nullable: true })
  address!: string | null;

  @Column({ type: 'varchar',  name: 'moh_facility_code', nullable: true })
  mohFacilityCode!: string | null;

  @Column({ type: 'varchar',  name: 'licence_number', nullable: true })
  licenceNumber!: string | null;

  @Column({ type: 'boolean',  default: true })
  active!: boolean;
}

@Entity({ name: 'settings', schema: 'public' })
export class TenantSettings extends AuditableEntity {
  @OneToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ type: 'varchar',  name: 'sms_sender_name', default: 'AfyaSasa' })
  smsSenderName!: string;

  @Column({ type: 'varchar',  name: 'patient_id_prefix', default: 'AFYA' })
  patientIdPrefix!: string;

  @Column({ type: 'varchar',  name: 'triage_system', default: 'manchester_ke' })
  triageSystem!: string;

  @Column({ type: 'jsonb', name: 'clinical_catalog', default: () => `'{}'` })
  clinicalCatalog!: Record<string, unknown>;
}

@Entity({ name: 'roles', schema: 'demo' })
@Unique(['name'])
export class Role extends AuditableEntity {
  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  label!: string;

  @Column({ type: 'varchar',  nullable: true })
  description!: string | null;

  @Column({ type: 'boolean',  name: 'is_system', default: false })
  isSystem!: boolean;
}

@Entity({ name: 'permissions', schema: 'demo' })
@Unique(['resource', 'action'])
export class Permission extends AuditableEntity {
  @Column({ type: 'varchar' })
  resource!: string;

  @Column({ type: 'varchar' })
  action!: string;

  @Column({ type: 'varchar',  name: 'permission_key' })
  permissionKey!: string;

  @Column({ type: 'varchar',  nullable: true })
  description!: string | null;
}

@Entity({ name: 'role_permissions', schema: 'demo' })
@Unique(['role', 'permission'])
export class RolePermission extends AuditableEntity {
  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission!: Permission;

  @Column({ name: 'granted_by', type: 'uuid', nullable: true })
  grantedBy!: string | null;
}

@Entity({ name: 'users', schema: 'demo' })
@Unique(['employeeNo'])
@Unique(['email'])
export class User extends AuditableEntity {
  @Column({ type: 'varchar',  name: 'employee_no' })
  employeeNo!: string;

  @Column({ type: 'varchar',  name: 'first_name' })
  firstName!: string;

  @Column({ type: 'varchar',  name: 'last_name' })
  lastName!: string;

  @Column({ type: 'varchar' })
  email!: string;

  @Column({ type: 'varchar',  nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar',  name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'varchar',  nullable: true })
  specialisation!: string | null;

  @Column({ type: 'varchar',  name: 'kmpdc_licence', nullable: true })
  kmpdcLicence!: string | null;

  @Column({ type: 'boolean',  default: true })
  active!: boolean;

  @Column({ type: 'boolean',  name: 'force_password_change', default: true })
  forcePasswordChange!: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ type: 'int',  name: 'failed_login_attempts', default: 0 })
  failedLoginAttempts!: number;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil!: Date | null;
}

@Entity({ name: 'user_roles', schema: 'demo' })
@Unique(['user', 'role'])
export class UserRole extends AuditableEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @Column({ name: 'granted_by', type: 'uuid', nullable: true })
  grantedBy!: string | null;
}

@Entity({ name: 'departments', schema: 'demo' })
@Unique(['code'])
export class Department extends AuditableEntity {
  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  code!: string;

  @Column({ type: 'varchar', nullable: true })
  type!: string | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;
}

@Entity({ name: 'user_departments', schema: 'demo' })
@Unique(['user', 'department'])
export class UserDepartment extends AuditableEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Department, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'department_id' })
  department!: Department;

  @Column({ type: 'boolean', name: 'is_primary', default: false })
  isPrimary!: boolean;
}

@Entity({ name: 'refresh_tokens', schema: 'demo' })
@Index(['userId', 'revokedAt'])
export class RefreshToken extends AuditableEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar',  name: 'token_hash' })
  tokenHash!: string;

  @Column({ type: 'varchar',  nullable: true })
  device!: string | null;

  @Column({ type: 'varchar',  nullable: true })
  ip!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}

@Entity({ name: 'audit_logs', schema: 'demo' })
@Index(['recordType', 'recordId'])
@Index(['action', 'createdAt'])
export class AuditLog {
  @Column({ type: 'uuid', primary: true, generated: 'uuid' })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar' })
  action!: string;

  @Column({ type: 'varchar',  name: 'record_type', nullable: true })
  recordType!: string | null;

  @Column({ type: 'varchar',  name: 'record_id', nullable: true })
  recordId!: string | null;

  @Column({ name: 'before_json', type: 'jsonb', nullable: true })
  beforeJson!: Record<string, unknown> | null;

  @Column({ name: 'after_json', type: 'jsonb', nullable: true })
  afterJson!: Record<string, unknown> | null;

  @Column({ type: 'varchar',  nullable: true })
  ip!: string | null;

  @Column({ type: 'varchar',  name: 'user_agent', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'varchar',  name: 'session_id', nullable: true })
  sessionId!: string | null;

  @Column({ type: 'varchar' })
  endpoint!: string;

  @Column({ type: 'int',  name: 'http_code' })
  httpCode!: number;

  @Column({ type: 'int',  name: 'duration_ms' })
  durationMs!: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
