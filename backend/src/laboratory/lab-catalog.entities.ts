import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import type { CalculatedFormula, ReferenceGender, ResultDataType } from './lab-catalog.types';

@Entity({ name: 'lab_departments', schema: 'demo' })
export class LabDepartment extends SoftDeleteClinicalEntity {
  @Column({ type: 'varchar', unique: true })
  code!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;
}

@Entity({ name: 'lab_specimen_types', schema: 'demo' })
export class SpecimenType extends SoftDeleteClinicalEntity {
  @Column({ type: 'varchar', unique: true })
  code!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', name: 'container_description' })
  containerDescription!: string;

  @Column({ type: 'varchar', nullable: true })
  additive!: string | null;

  @Column({ type: 'varchar', nullable: true })
  color!: string | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;
}

/**
 * Orderable laboratory test or panel (catalog LabTest).
 * Legacy analyte rows remain in demo.lab_tests for backward-compatible ordering.
 */
@Entity({ name: 'lab_orderable_tests', schema: 'demo' })
@Index(['department', 'active'])
export class OrderableLabTest extends SoftDeleteClinicalEntity {
  @ManyToOne(() => LabDepartment)
  @JoinColumn({ name: 'department_id' })
  department!: LabDepartment;

  @ManyToOne(() => SpecimenType)
  @JoinColumn({ name: 'specimen_id' })
  specimen!: SpecimenType;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', unique: true })
  code!: string;

  @Column({ type: 'boolean', name: 'is_panel', default: false })
  isPanel!: boolean;

  @Column({ type: 'int', name: 'standard_tat_minutes', default: 240 })
  standardTatMinutes!: number;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ name: 'legacy_panel_id', type: 'uuid', nullable: true })
  legacyPanelId!: string | null;

  @OneToMany(() => LabTestParameter, (parameter) => parameter.orderableTest)
  parameters!: LabTestParameter[];
}

@Entity({ name: 'lab_test_parameters', schema: 'demo' })
@Index(['orderableTest', 'orderIndex'])
@Index(['orderableTest', 'code'], { unique: true })
export class LabTestParameter extends SoftDeleteClinicalEntity {
  @ManyToOne(() => OrderableLabTest, (test) => test.parameters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lab_test_id' })
  orderableTest!: OrderableLabTest;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  code!: string;

  @Column({ type: 'varchar', nullable: true })
  unit!: string | null;

  @Column({ type: 'varchar', name: 'result_data_type' })
  resultDataType!: ResultDataType;

  @Column({ type: 'jsonb', name: 'select_options', nullable: true })
  selectOptions!: string[] | null;

  @Column({ type: 'int', name: 'order_index', default: 0 })
  orderIndex!: number;

  @Column({ type: 'varchar', name: 'calculated_formula', nullable: true })
  calculatedFormula!: CalculatedFormula | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ name: 'legacy_test_id', type: 'uuid', nullable: true })
  legacyTestId!: string | null;

  @OneToMany(() => LabReferenceRange, (range) => range.parameter)
  referenceRanges!: LabReferenceRange[];
}

@Entity({ name: 'lab_reference_ranges', schema: 'demo' })
@Index(['parameter', 'gender'])
export class LabReferenceRange extends SoftDeleteClinicalEntity {
  @ManyToOne(() => LabTestParameter, (parameter) => parameter.referenceRanges, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parameter_id' })
  parameter!: LabTestParameter;

  @Column({ type: 'varchar' })
  gender!: ReferenceGender;

  @Column({ type: 'int', name: 'age_min_days', nullable: true })
  ageMinDays!: number | null;

  @Column({ type: 'int', name: 'age_max_days', nullable: true })
  ageMaxDays!: number | null;

  @Column({ type: 'numeric', name: 'range_low', nullable: true })
  rangeLow!: string | null;

  @Column({ type: 'numeric', name: 'range_high', nullable: true })
  rangeHigh!: string | null;

  @Column({ type: 'numeric', name: 'critical_low', nullable: true })
  criticalLow!: string | null;

  @Column({ type: 'numeric', name: 'critical_high', nullable: true })
  criticalHigh!: string | null;

  @Column({ type: 'varchar', name: 'normal_text_value', nullable: true })
  normalTextValue!: string | null;
}
