import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';

export type InventoryCategory = 'pharmaceutical' | 'medical_consumable' | 'non_medical';
export type InventoryLocationType = 'pharmacy' | 'main_store' | 'ward' | 'theatre' | 'ed' | 'other';
export type InventoryTransactionType =
  | 'RECEIPT'
  | 'ISSUE'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'RETURN'
  | 'ADJUSTMENT'
  | 'DISPENSE'
  | 'STOCK_TAKE';

export type RequisitionStatus =
  | 'submitted'
  | 'approved'
  | 'issued'
  | 'completed'
  | 'cancelled';

export type RequisitionFulfillmentRoute = 'pharmacy' | 'main_store';

export type RequisitionLineStatus = 'pending' | 'issued' | 'cancelled';

export type TransferStatus = 'pending' | 'in_transit' | 'completed' | 'cancelled';

export type InventoryReservationStatus = 'held' | 'consumed' | 'released';

@Entity({ name: 'inventory_items', schema: 'demo' })
@Unique(['sku'])
export class InventoryItem extends SoftDeleteClinicalEntity {
  @Column({ type: 'varchar' })
  sku!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  category!: InventoryCategory;

  @Column({ type: 'varchar', name: 'drug_class', nullable: true })
  drugClass!: string | null;

  @Column({ type: 'varchar' })
  unit!: string;

  @Column({ type: 'varchar', nullable: true, select: false })
  strength!: string | null;

  @Column({ type: 'varchar', name: 'dosage_form', nullable: true, select: false })
  dosageForm!: string | null;

  @Column({ type: 'boolean', name: 'track_batch', default: false })
  trackBatch!: boolean;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'numeric', name: 'min_level', nullable: true, select: false })
  minLevel!: string | null;

  @Column({ type: 'numeric', name: 'max_level', nullable: true, select: false })
  maxLevel!: string | null;
}

@Entity({ name: 'inventory_locations', schema: 'demo' })
@Unique(['code'])
export class InventoryLocation extends SoftDeleteClinicalEntity {
  @Column({ type: 'varchar' })
  code!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', name: 'location_type' })
  locationType!: InventoryLocationType;

  @Column({ type: 'boolean', default: true })
  active!: boolean;
}

@Entity({ name: 'inventory_batches', schema: 'demo' })
@Index(['item', 'location'])
export class InventoryBatch extends SoftDeleteClinicalEntity {
  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'item_id' })
  item!: InventoryItem;

  @ManyToOne(() => InventoryLocation)
  @JoinColumn({ name: 'location_id' })
  location!: InventoryLocation;

  @Column({ type: 'varchar', name: 'batch_no', nullable: true })
  batchNo!: string | null;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate!: string | null;

  @Column({ type: 'numeric', name: 'qty_on_hand', default: 0 })
  qtyOnHand!: string;
}

@Entity({ name: 'inventory_transactions', schema: 'demo' })
@Index(['item', 'createdAt'])
export class InventoryTransaction extends SoftDeleteClinicalEntity {
  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'item_id' })
  item!: InventoryItem;

  @ManyToOne(() => InventoryBatch, { nullable: true })
  @JoinColumn({ name: 'batch_id' })
  batch!: InventoryBatch | null;

  @ManyToOne(() => InventoryLocation, { nullable: true })
  @JoinColumn({ name: 'source_location_id' })
  sourceLocation!: InventoryLocation | null;

  @ManyToOne(() => InventoryLocation, { nullable: true })
  @JoinColumn({ name: 'destination_location_id' })
  destinationLocation!: InventoryLocation | null;

  @Column({ type: 'numeric' })
  quantity!: string;

  @Column({ type: 'varchar' })
  unit!: string;

  @Column({ type: 'varchar', name: 'transaction_type' })
  transactionType!: InventoryTransactionType;

  @Column({ type: 'varchar', name: 'reference_type', nullable: true })
  referenceType!: string | null;

  @Column({ type: 'uuid', name: 'reference_id', nullable: true })
  referenceId!: string | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;
}

@Entity({ name: 'inventory_requisitions', schema: 'demo' })
@Unique(['requisitionNo'])
export class InventoryRequisition extends SoftDeleteClinicalEntity {
  @Column({ type: 'varchar', name: 'requisition_no' })
  requisitionNo!: string;

  @Column({ type: 'varchar', name: 'requesting_department' })
  requestingDepartment!: string;

  @Column({ type: 'varchar' })
  status!: RequisitionStatus;

  @ManyToOne(() => InventoryLocation, { nullable: true })
  @JoinColumn({ name: 'destination_location_id' })
  destinationLocation!: InventoryLocation | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany(() => InventoryRequisitionLine, (line) => line.requisition)
  lines!: InventoryRequisitionLine[];
}

@Entity({ name: 'inventory_requisition_lines', schema: 'demo' })
@Index(['requisition'])
export class InventoryRequisitionLine extends SoftDeleteClinicalEntity {
  @ManyToOne(() => InventoryRequisition, (requisition) => requisition.lines)
  @JoinColumn({ name: 'requisition_id' })
  requisition!: InventoryRequisition;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'item_id' })
  item!: InventoryItem;

  @Column({ type: 'numeric', name: 'quantity_requested' })
  quantityRequested!: string;

  @Column({ type: 'numeric', name: 'quantity_issued', default: 0 })
  quantityIssued!: string;

  @Column({ type: 'varchar', name: 'fulfillment_route' })
  fulfillmentRoute!: RequisitionFulfillmentRoute;

  @ManyToOne(() => InventoryLocation)
  @JoinColumn({ name: 'source_location_id' })
  sourceLocation!: InventoryLocation;

  @Column({ type: 'varchar' })
  status!: RequisitionLineStatus;
}

@Entity({ name: 'inventory_transfers', schema: 'demo' })
@Unique(['transferNo'])
export class InventoryTransfer extends SoftDeleteClinicalEntity {
  @Column({ type: 'varchar', name: 'transfer_no' })
  transferNo!: string;

  @ManyToOne(() => InventoryLocation)
  @JoinColumn({ name: 'source_location_id' })
  sourceLocation!: InventoryLocation;

  @ManyToOne(() => InventoryLocation)
  @JoinColumn({ name: 'destination_location_id' })
  destinationLocation!: InventoryLocation;

  @Column({ type: 'varchar' })
  status!: TransferStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany(() => InventoryTransferLine, (line) => line.transfer)
  lines!: InventoryTransferLine[];
}

@Entity({ name: 'inventory_transfer_lines', schema: 'demo' })
@Index(['transfer'])
export class InventoryTransferLine extends SoftDeleteClinicalEntity {
  @ManyToOne(() => InventoryTransfer, (transfer) => transfer.lines)
  @JoinColumn({ name: 'transfer_id' })
  transfer!: InventoryTransfer;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'item_id' })
  item!: InventoryItem;

  @Column({ type: 'numeric' })
  quantity!: string;

  @ManyToOne(() => InventoryBatch, { nullable: true })
  @JoinColumn({ name: 'batch_id' })
  batch!: InventoryBatch | null;

  @Column({ type: 'varchar', default: 'pending' })
  status!: 'pending' | 'shipped' | 'received';
}

/**
 * Holds available pharmacy stock without changing qty_on_hand or the movement ledger.
 * Integrity reports must keep reconciling on-hand to inventory_transactions only.
 */
@Entity({ name: 'inventory_reservations', schema: 'demo' })
@Index(['saleId', 'status'])
@Index(['batch'])
export class InventoryReservation extends SoftDeleteClinicalEntity {
  @Column({ type: 'varchar', name: 'sale_id' })
  saleId!: string;

  @Column({ type: 'uuid', name: 'clinical_order_id', nullable: true })
  clinicalOrderId!: string | null;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'item_id' })
  item!: InventoryItem;

  @ManyToOne(() => InventoryBatch)
  @JoinColumn({ name: 'batch_id' })
  batch!: InventoryBatch;

  @ManyToOne(() => InventoryLocation)
  @JoinColumn({ name: 'location_id' })
  location!: InventoryLocation;

  @Column({ type: 'numeric' })
  quantity!: string;

  @Column({ type: 'varchar' })
  status!: InventoryReservationStatus;

  @Column({ type: 'varchar', name: 'prepare_op_id', nullable: true })
  prepareOpId!: string | null;
}

export type StockTakeSessionStatus = 'open' | 'submitted' | 'rejected' | 'posted';

@Entity({ name: 'inventory_stock_take_sessions', schema: 'demo' })
@Index(['location', 'status'])
export class InventoryStockTakeSession extends SoftDeleteClinicalEntity {
  @ManyToOne(() => InventoryLocation)
  @JoinColumn({ name: 'location_id' })
  location!: InventoryLocation;

  @Column({ type: 'varchar', default: 'open' })
  status!: StockTakeSessionStatus;

  @Column({ type: 'timestamptz', name: 'baseline_at' })
  baselineAt!: Date;

  @Column({ type: 'varchar', nullable: true })
  notes!: string | null;

  @Column({ type: 'uuid', name: 'submitted_by', nullable: true })
  submittedBy!: string | null;

  @Column({ type: 'timestamptz', name: 'submitted_at', nullable: true })
  submittedAt!: Date | null;

  @Column({ type: 'uuid', name: 'rejected_by', nullable: true })
  rejectedBy!: string | null;

  @Column({ type: 'timestamptz', name: 'rejected_at', nullable: true })
  rejectedAt!: Date | null;

  @Column({ type: 'varchar', name: 'reject_reason', nullable: true })
  rejectReason!: string | null;

  @Column({ type: 'uuid', name: 'approved_by', nullable: true })
  approvedBy!: string | null;

  @Column({ type: 'timestamptz', name: 'approved_at', nullable: true })
  approvedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'posted_at', nullable: true })
  postedAt!: Date | null;

  @OneToMany(() => InventoryStockTakeLine, (line) => line.session)
  lines!: InventoryStockTakeLine[];
}

@Entity({ name: 'inventory_stock_take_lines', schema: 'demo' })
@Index(['session'])
export class InventoryStockTakeLine extends SoftDeleteClinicalEntity {
  @ManyToOne(() => InventoryStockTakeSession, (session) => session.lines)
  @JoinColumn({ name: 'session_id' })
  session!: InventoryStockTakeSession;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'item_id' })
  item!: InventoryItem;

  @ManyToOne(() => InventoryBatch, { nullable: true })
  @JoinColumn({ name: 'batch_id' })
  batch!: InventoryBatch | null;

  @Column({ type: 'numeric', name: 'expected_qty' })
  expectedQty!: string;

  @Column({ type: 'numeric', name: 'counted_qty', nullable: true })
  countedQty!: string | null;

  @Column({ type: 'numeric', name: 'variance_qty', nullable: true })
  varianceQty!: string | null;

  @Column({ type: 'varchar', nullable: true })
  reason!: string | null;
}
