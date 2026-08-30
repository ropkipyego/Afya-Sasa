import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { ClinicalOrderMirrorService } from '../clinical-order/clinical-order-mirror.service';
import { ClinicalOrder } from '../clinical-order/clinical-order.entities';
import { CreateInventoryItemDto, CreateRequisitionDto, CreateTransferDto, DispenseOtcDto, DispensePharmacyDto, ReceiveStockDto } from './inventory.dto';
import {
  InventoryBatch,
  InventoryItem,
  InventoryLocation,
  InventoryRequisition,
  InventoryRequisitionLine,
  InventoryTransaction,
  InventoryTransfer,
  InventoryTransferLine,
  type InventoryCategory,
  type RequisitionFulfillmentRoute,
} from './inventory.entities';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly items: Repository<InventoryItem>,
    @InjectRepository(InventoryLocation)
    private readonly locations: Repository<InventoryLocation>,
    @InjectRepository(InventoryBatch)
    private readonly batches: Repository<InventoryBatch>,
    @InjectRepository(InventoryTransaction)
    private readonly transactions: Repository<InventoryTransaction>,
    @InjectRepository(InventoryRequisition)
    private readonly requisitions: Repository<InventoryRequisition>,
    @InjectRepository(InventoryRequisitionLine)
    private readonly requisitionLines: Repository<InventoryRequisitionLine>,
    @InjectRepository(InventoryTransfer)
    private readonly transfers: Repository<InventoryTransfer>,
    @InjectRepository(InventoryTransferLine)
    private readonly transferLines: Repository<InventoryTransferLine>,
    @InjectRepository(ClinicalOrder)
    private readonly clinicalOrders: Repository<ClinicalOrder>,
    private readonly clinicalOrderMirror: ClinicalOrderMirrorService,
  ) {}

  listLocations() {
    return this.locations.find({
      where: { active: true },
      order: { name: 'ASC' },
    });
  }

  listTransactions(params?: { limit?: number; itemId?: string }) {
    const take = Math.min(Math.max(params?.limit ?? 100, 1), 200);
    return this.transactions.find({
      where: params?.itemId ? { item: { id: params.itemId } } : {},
      relations: {
        item: true,
        batch: true,
        sourceLocation: true,
        destinationLocation: true,
      },
      order: { createdAt: 'DESC' },
      take,
    });
  }

  listItems(params?: { category?: InventoryItem['category'] }) {
    return this.items.find({
      where: {
        active: true,
        ...(params?.category ? { category: params.category } : {}),
      },
      order: { name: 'ASC' },
    });
  }

  async createItem(dto: CreateInventoryItemDto, request: RequestContext) {
    const existing = await this.items.findOne({ where: { sku: dto.sku.trim().toUpperCase() } });
    if (existing) {
      throw new BadRequestException('SKU already exists');
    }
    const trackBatch =
      dto.trackBatch ?? dto.category === 'pharmaceutical';
    return this.items.save(
      this.items.create({
        sku: dto.sku.trim().toUpperCase(),
        name: dto.name.trim(),
        category: dto.category,
        unit: dto.unit.trim(),
        trackBatch,
        active: true,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async locationBalances(locationId: string) {
    const location = await this.locations.findOne({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException('Location not found');
    }
    const batches = await this.batches.find({
      where: { location: { id: locationId } },
      relations: { item: true, location: true },
      order: { expiryDate: 'ASC' },
    });
    return {
      location,
      batches: batches.filter((batch) => Number(batch.qtyOnHand) > 0),
    };
  }

  async receiveStock(dto: ReceiveStockDto, request: RequestContext) {
    const item = await this.items.findOne({ where: { id: dto.itemId, active: true } });
    if (!item) {
      throw new NotFoundException('Item not found');
    }
    const location = await this.locations.findOne({ where: { id: dto.locationId, active: true } });
    if (!location) {
      throw new NotFoundException('Location not found');
    }
    if (item.category === 'pharmaceutical' && location.locationType !== 'pharmacy') {
      throw new BadRequestException('Pharmaceutical items must be received into Pharmacy');
    }
    if (item.trackBatch && !dto.batchNo?.trim()) {
      throw new BadRequestException('Batch number is required for this item');
    }
    if (item.trackBatch && !dto.expiryDate) {
      throw new BadRequestException('Expiry date is required for batch-tracked items');
    }

    const qty = dto.quantity.toString();
    let batch: InventoryBatch | null = null;

    if (item.trackBatch) {
      batch = await this.batches.findOne({
        where: {
          item: { id: item.id },
          location: { id: location.id },
          batchNo: dto.batchNo!.trim(),
        },
      });
      if (batch) {
        batch.qtyOnHand = (Number(batch.qtyOnHand) + dto.quantity).toString();
        batch.updatedBy = request.user?.sub ?? null;
        batch = await this.batches.save(batch);
      } else {
        batch = await this.batches.save(
          this.batches.create({
            item,
            location,
            batchNo: dto.batchNo!.trim(),
            expiryDate: dto.expiryDate ?? null,
            qtyOnHand: qty,
            createdBy: request.user?.sub ?? null,
            updatedBy: request.user?.sub ?? null,
          }),
        );
      }
    } else {
      batch = await this.batches.findOne({
        where: { item: { id: item.id }, location: { id: location.id }, batchNo: IsNull() },
      });
      if (!batch) {
        batch = await this.batches.save(
          this.batches.create({
            item,
            location,
            batchNo: null,
            expiryDate: null,
            qtyOnHand: qty,
            createdBy: request.user?.sub ?? null,
            updatedBy: request.user?.sub ?? null,
          }),
        );
      } else {
        batch.qtyOnHand = (Number(batch.qtyOnHand) + dto.quantity).toString();
        batch.updatedBy = request.user?.sub ?? null;
        batch = await this.batches.save(batch);
      }
    }

    const transaction = await this.transactions.save(
      this.transactions.create({
        item,
        batch,
        sourceLocation: null,
        destinationLocation: location,
        quantity: qty,
        unit: item.unit,
        transactionType: 'RECEIPT',
        referenceType: 'receipt',
        referenceId: batch.id,
        reason: dto.reason?.trim() || null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );

    return { batch, transaction };
  }

  async dispensePharmacyOrder(dto: DispensePharmacyDto, request: RequestContext) {
    const order = await this.clinicalOrders.findOne({
      where: { id: dto.clinicalOrderId, orderType: 'pharmacy' },
      relations: { patient: true },
    });
    if (!order) {
      throw new NotFoundException('Pharmacy order not found');
    }
    if (order.status === 'dispensed') {
      throw new BadRequestException('Order already dispensed');
    }

    const pharmacy = await this.locations.findOne({ where: { code: 'PHARMACY', active: true } });
    if (!pharmacy) {
      throw new NotFoundException('Pharmacy location not configured');
    }

    let item: InventoryItem | null = null;
    if (dto.itemId) {
      item = await this.items.findOne({ where: { id: dto.itemId, active: true } });
    } else {
      const medication = String(order.metadata?.medication ?? '').toLowerCase();
      if (medication.includes('paracetamol')) {
        item = await this.items.findOne({ where: { sku: 'PARA500', active: true } });
      }
    }
    if (!item) {
      throw new BadRequestException('Could not match medication to inventory item — provide itemId');
    }

    const batches = await this.batches.find({
      where: {
        item: { id: item.id },
        location: { id: pharmacy.id },
        qtyOnHand: MoreThan('0'),
      },
      relations: { item: true, location: true },
      order: { expiryDate: 'ASC', createdAt: 'ASC' },
    });

    const allocations = this.allocateFromBatches(batches, dto.quantity);

    const ledgerRows: InventoryTransaction[] = [];
    for (const { batch, quantity } of allocations) {
      batch.qtyOnHand = (Number(batch.qtyOnHand) - quantity).toString();
      batch.updatedBy = request.user?.sub ?? null;
      await this.batches.save(batch);
      ledgerRows.push(
        await this.transactions.save(
          this.transactions.create({
            item,
            batch,
            sourceLocation: pharmacy,
            destinationLocation: null,
            quantity: (-quantity).toString(),
            unit: item.unit,
            transactionType: 'DISPENSE',
            referenceType: 'clinical_order',
            referenceId: order.id,
            reason: `Dispense for ${order.orderNo}`,
            createdBy: request.user?.sub ?? null,
            updatedBy: request.user?.sub ?? null,
          }),
        ),
      );
    }

    await this.clinicalOrderMirror.syncSourceStatus(
      'pharmacy',
      order.sourceRecordId,
      'dispensed',
      request,
    );

    return {
      orderId: order.id,
      item,
      allocations: allocations.map(({ batch, quantity }) => ({
        batchId: batch.id,
        batchNo: batch.batchNo,
        quantity,
      })),
      transactions: ledgerRows,
    };
  }

  async dispenseOtcSale(dto: DispenseOtcDto, request: RequestContext) {
    const pharmacy = await this.locations.findOne({ where: { code: 'PHARMACY', active: true } });
    if (!pharmacy) {
      throw new NotFoundException('Pharmacy location not configured');
    }

    const item = await this.items.findOne({ where: { id: dto.itemId, active: true } });
    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }
    if (item.category !== 'pharmaceutical') {
      throw new BadRequestException('OTC sales are limited to pharmaceutical items');
    }

    const batches = await this.batches.find({
      where: {
        item: { id: item.id },
        location: { id: pharmacy.id },
        qtyOnHand: MoreThan('0'),
      },
      relations: { item: true, location: true },
      order: { expiryDate: 'ASC', createdAt: 'ASC' },
    });

    const allocations = this.allocateFromBatches(batches, dto.quantity);
    const ledgerRows: InventoryTransaction[] = [];

    for (const { batch, quantity } of allocations) {
      batch.qtyOnHand = (Number(batch.qtyOnHand) - quantity).toString();
      batch.updatedBy = request.user?.sub ?? null;
      await this.batches.save(batch);
      ledgerRows.push(
        await this.transactions.save(
          this.transactions.create({
            item,
            batch,
            sourceLocation: pharmacy,
            destinationLocation: null,
            quantity: (-quantity).toString(),
            unit: item.unit,
            transactionType: 'DISPENSE',
            referenceType: 'otc_sale',
            referenceId: dto.patientId ?? null,
            reason: dto.notes?.trim() || 'OTC sale',
            createdBy: request.user?.sub ?? null,
            updatedBy: request.user?.sub ?? null,
          }),
        ),
      );
    }

    return {
      item,
      patientId: dto.patientId ?? null,
      allocations: allocations.map(({ batch, quantity }) => ({
        batchId: batch.id,
        batchNo: batch.batchNo,
        quantity,
      })),
      transactions: ledgerRows,
    };
  }

  listRequisitions(params?: { status?: InventoryRequisition['status'] }) {
    return this.requisitions.find({
      where: {
        ...(params?.status ? { status: params.status } : {}),
      },
      relations: {
        destinationLocation: true,
        lines: { item: true, sourceLocation: true },
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getRequisition(id: string) {
    const requisition = await this.requisitions.findOne({
      where: { id },
      relations: {
        destinationLocation: true,
        lines: { item: true, sourceLocation: true },
      },
    });
    if (!requisition) {
      throw new NotFoundException('Requisition not found');
    }
    return requisition;
  }

  async createRequisition(dto: CreateRequisitionDto, request: RequestContext) {
    if (!dto.lines.length) {
      throw new BadRequestException('At least one requisition line is required');
    }

    const pharmacy = await this.requireLocationCode('PHARMACY');
    const mainStore = await this.requireLocationCode('MAIN_STORE');

    let destination: InventoryLocation | null = null;
    if (dto.destinationLocationId) {
      destination = await this.locations.findOne({
        where: { id: dto.destinationLocationId, active: true },
      });
      if (!destination) {
        throw new NotFoundException('Destination location not found');
      }
    } else {
      destination = await this.locations.findOne({
        where: { code: 'WARD-GENERAL', active: true },
      });
    }

    const requisitionNo = await this.nextRequisitionNo();
    const requisition = await this.requisitions.save(
      this.requisitions.create({
        requisitionNo,
        requestingDepartment: dto.requestingDepartment.trim(),
        status: 'submitted',
        destinationLocation: destination,
        notes: dto.notes?.trim() || null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );

    for (const line of dto.lines) {
      const item = await this.items.findOne({ where: { id: line.itemId, active: true } });
      if (!item) {
        throw new NotFoundException(`Item not found: ${line.itemId}`);
      }
      const route = this.routeFulfillment(item.category);
      const sourceLocation = route === 'pharmacy' ? pharmacy : mainStore;
      await this.requisitionLines.save(
        this.requisitionLines.create({
          requisition,
          item,
          quantityRequested: line.quantity.toString(),
          quantityIssued: '0',
          fulfillmentRoute: route,
          sourceLocation,
          status: 'pending',
          createdBy: request.user?.sub ?? null,
          updatedBy: request.user?.sub ?? null,
        }),
      );
    }

    return this.getRequisition(requisition.id);
  }

  async approveRequisition(id: string, request: RequestContext) {
    const requisition = await this.getRequisition(id);
    if (requisition.status !== 'submitted') {
      throw new BadRequestException('Only submitted requisitions can be approved');
    }
    requisition.status = 'approved';
    requisition.updatedBy = request.user?.sub ?? null;
    await this.requisitions.save(requisition);
    return this.getRequisition(id);
  }

  async issueRequisition(id: string, request: RequestContext) {
    const requisition = await this.getRequisition(id);
    if (requisition.status !== 'approved') {
      throw new BadRequestException('Requisition must be approved before issue');
    }
    if (!requisition.destinationLocation) {
      throw new BadRequestException('Requisition has no destination location');
    }

    const ledgerRows: InventoryTransaction[] = [];
    for (const line of requisition.lines) {
      if (line.status !== 'pending') continue;

      const qty = Number(line.quantityRequested);
      const batches = await this.batches.find({
        where: {
          item: { id: line.item.id },
          location: { id: line.sourceLocation.id },
          qtyOnHand: MoreThan('0'),
        },
        relations: { item: true, location: true },
        order: { expiryDate: 'ASC', createdAt: 'ASC' },
      });

      const allocations = this.allocateFromBatches(batches, qty);
      for (const { batch, quantity } of allocations) {
        batch.qtyOnHand = (Number(batch.qtyOnHand) - quantity).toString();
        batch.updatedBy = request.user?.sub ?? null;
        await this.batches.save(batch);
        ledgerRows.push(
          await this.transactions.save(
            this.transactions.create({
              item: line.item,
              batch,
              sourceLocation: line.sourceLocation,
              destinationLocation: requisition.destinationLocation,
              quantity: (-quantity).toString(),
              unit: line.item.unit,
              transactionType: 'ISSUE',
              referenceType: 'requisition',
              referenceId: requisition.id,
              reason: `Issue ${requisition.requisitionNo} to ${requisition.requestingDepartment}`,
              createdBy: request.user?.sub ?? null,
              updatedBy: request.user?.sub ?? null,
            }),
          ),
        );
        const destCredit = await this.creditLocationBatch({
          item: line.item,
          sourceBatch: batch,
          destinationLocation: requisition.destinationLocation,
          quantity,
          transactionType: 'RECEIPT',
          referenceType: 'requisition',
          referenceId: requisition.id,
          reason: `Receive ${requisition.requisitionNo} at ${requisition.destinationLocation.name}`,
          request,
        });
        ledgerRows.push(destCredit.transaction);
      }

      line.quantityIssued = qty.toString();
      line.status = 'issued';
      line.updatedBy = request.user?.sub ?? null;
      await this.requisitionLines.save(line);
    }

    requisition.status = 'issued';
    requisition.updatedBy = request.user?.sub ?? null;
    await this.requisitions.save(requisition);

    return {
      requisition: await this.getRequisition(id),
      transactions: ledgerRows,
    };
  }

  async acknowledgeRequisition(id: string, request: RequestContext) {
    const requisition = await this.getRequisition(id);
    if (requisition.status !== 'issued') {
      throw new BadRequestException('Only issued requisitions can be acknowledged');
    }
    requisition.status = 'completed';
    requisition.updatedBy = request.user?.sub ?? null;
    await this.requisitions.save(requisition);
    return this.getRequisition(id);
  }

  listTransfers(params?: { status?: InventoryTransfer['status'] }) {
    return this.transfers.find({
      where: params?.status ? { status: params.status } : {},
      relations: {
        sourceLocation: true,
        destinationLocation: true,
        lines: { item: true, batch: true },
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getTransfer(id: string) {
    const transfer = await this.transfers.findOne({
      where: { id },
      relations: {
        sourceLocation: true,
        destinationLocation: true,
        lines: { item: true, batch: true },
      },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    return transfer;
  }

  async createTransfer(dto: CreateTransferDto, request: RequestContext) {
    if (!dto.lines.length) {
      throw new BadRequestException('At least one transfer line is required');
    }
    if (dto.sourceLocationId === dto.destinationLocationId) {
      throw new BadRequestException('Source and destination must differ');
    }
    const source = await this.locations.findOne({ where: { id: dto.sourceLocationId, active: true } });
    const destination = await this.locations.findOne({
      where: { id: dto.destinationLocationId, active: true },
    });
    if (!source || !destination) {
      throw new NotFoundException('Source or destination location not found');
    }

    const transferNo = await this.nextTransferNo();
    const transfer = await this.transfers.save(
      this.transfers.create({
        transferNo,
        sourceLocation: source,
        destinationLocation: destination,
        status: 'pending',
        notes: dto.notes?.trim() || null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );

    for (const line of dto.lines) {
      const item = await this.items.findOne({ where: { id: line.itemId, active: true } });
      if (!item) throw new NotFoundException(`Item not found: ${line.itemId}`);
      await this.transferLines.save(
        this.transferLines.create({
          transfer,
          item,
          quantity: line.quantity.toString(),
          status: 'pending',
          createdBy: request.user?.sub ?? null,
          updatedBy: request.user?.sub ?? null,
        }),
      );
    }
    return this.getTransfer(transfer.id);
  }

  async shipTransfer(id: string, request: RequestContext) {
    const transfer = await this.getTransfer(id);
    if (transfer.status !== 'pending') {
      throw new BadRequestException('Only pending transfers can be shipped');
    }

    for (const line of transfer.lines) {
      const qty = Number(line.quantity);
      const batches = await this.batches.find({
        where: {
          item: { id: line.item.id },
          location: { id: transfer.sourceLocation.id },
          qtyOnHand: MoreThan('0'),
        },
        relations: { item: true, location: true },
        order: { expiryDate: 'ASC', createdAt: 'ASC' },
      });
      const allocations = this.allocateFromBatches(batches, qty);
      for (const { batch, quantity } of allocations) {
        batch.qtyOnHand = (Number(batch.qtyOnHand) - quantity).toString();
        batch.updatedBy = request.user?.sub ?? null;
        await this.batches.save(batch);
        await this.transactions.save(
          this.transactions.create({
            item: line.item,
            batch,
            sourceLocation: transfer.sourceLocation,
            destinationLocation: transfer.destinationLocation,
            quantity: (-quantity).toString(),
            unit: line.item.unit,
            transactionType: 'TRANSFER_OUT',
            referenceType: 'transfer',
            referenceId: transfer.id,
            reason: `Ship ${transfer.transferNo} to ${transfer.destinationLocation.name}`,
            createdBy: request.user?.sub ?? null,
            updatedBy: request.user?.sub ?? null,
          }),
        );
      }
      line.status = 'shipped';
      line.updatedBy = request.user?.sub ?? null;
      await this.transferLines.save(line);
    }

    transfer.status = 'in_transit';
    transfer.updatedBy = request.user?.sub ?? null;
    await this.transfers.save(transfer);
    return this.getTransfer(id);
  }

  async receiveTransfer(id: string, request: RequestContext) {
    const transfer = await this.getTransfer(id);
    if (transfer.status !== 'in_transit') {
      throw new BadRequestException('Transfer must be in transit before receive');
    }

    const outbound = await this.transactions.find({
      where: {
        referenceType: 'transfer',
        referenceId: transfer.id,
        transactionType: 'TRANSFER_OUT',
      },
      relations: { item: true, batch: true, sourceLocation: true, destinationLocation: true },
    });

    for (const txn of outbound) {
      const qty = Math.abs(Number(txn.quantity));
      const batch = txn.batch;
      let destBatch: InventoryBatch | null = null;

      if (batch?.batchNo) {
        destBatch = await this.batches.findOne({
          where: {
            item: { id: txn.item.id },
            location: { id: transfer.destinationLocation.id },
            batchNo: batch.batchNo,
          },
        });
        if (destBatch) {
          destBatch.qtyOnHand = (Number(destBatch.qtyOnHand) + qty).toString();
          destBatch.updatedBy = request.user?.sub ?? null;
          destBatch = await this.batches.save(destBatch);
        } else {
          destBatch = await this.batches.save(
            this.batches.create({
              item: txn.item,
              location: transfer.destinationLocation,
              batchNo: batch.batchNo,
              expiryDate: batch.expiryDate,
              qtyOnHand: qty.toString(),
              createdBy: request.user?.sub ?? null,
              updatedBy: request.user?.sub ?? null,
            }),
          );
        }
      } else {
        destBatch = await this.batches.findOne({
          where: {
            item: { id: txn.item.id },
            location: { id: transfer.destinationLocation.id },
            batchNo: IsNull(),
          },
        });
        if (destBatch) {
          destBatch.qtyOnHand = (Number(destBatch.qtyOnHand) + qty).toString();
          destBatch.updatedBy = request.user?.sub ?? null;
          destBatch = await this.batches.save(destBatch);
        } else {
          destBatch = await this.batches.save(
            this.batches.create({
              item: txn.item,
              location: transfer.destinationLocation,
              batchNo: null,
              expiryDate: null,
              qtyOnHand: qty.toString(),
              createdBy: request.user?.sub ?? null,
              updatedBy: request.user?.sub ?? null,
            }),
          );
        }
      }

      await this.transactions.save(
        this.transactions.create({
          item: txn.item,
          batch: destBatch,
          sourceLocation: transfer.sourceLocation,
          destinationLocation: transfer.destinationLocation,
          quantity: qty.toString(),
          unit: txn.unit,
          transactionType: 'TRANSFER_IN',
          referenceType: 'transfer',
          referenceId: transfer.id,
          reason: `Receive ${transfer.transferNo} at ${transfer.destinationLocation.name}`,
          createdBy: request.user?.sub ?? null,
          updatedBy: request.user?.sub ?? null,
        }),
      );
    }

    for (const line of transfer.lines) {
      line.status = 'received';
      line.updatedBy = request.user?.sub ?? null;
      await this.transferLines.save(line);
    }

    transfer.status = 'completed';
    transfer.updatedBy = request.user?.sub ?? null;
    await this.transfers.save(transfer);
    return this.getTransfer(id);
  }

  private async nextTransferNo() {
    const year = new Date().getFullYear();
    const count = await this.transfers.count();
    return `TRF-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private async creditLocationBatch(params: {
    item: InventoryItem;
    sourceBatch: InventoryBatch;
    destinationLocation: InventoryLocation;
    quantity: number;
    transactionType: InventoryTransaction['transactionType'];
    referenceType: string;
    referenceId: string;
    reason: string;
    request: RequestContext;
  }) {
    const { item, sourceBatch, destinationLocation, quantity, request } = params;
    let destBatch: InventoryBatch | null = null;

    if (sourceBatch.batchNo) {
      destBatch = await this.batches.findOne({
        where: {
          item: { id: item.id },
          location: { id: destinationLocation.id },
          batchNo: sourceBatch.batchNo,
        },
      });
      if (destBatch) {
        destBatch.qtyOnHand = (Number(destBatch.qtyOnHand) + quantity).toString();
        destBatch.updatedBy = request.user?.sub ?? null;
        destBatch = await this.batches.save(destBatch);
      } else {
        destBatch = await this.batches.save(
          this.batches.create({
            item,
            location: destinationLocation,
            batchNo: sourceBatch.batchNo,
            expiryDate: sourceBatch.expiryDate,
            qtyOnHand: quantity.toString(),
            createdBy: request.user?.sub ?? null,
            updatedBy: request.user?.sub ?? null,
          }),
        );
      }
    } else {
      destBatch = await this.batches.findOne({
        where: {
          item: { id: item.id },
          location: { id: destinationLocation.id },
          batchNo: IsNull(),
        },
      });
      if (destBatch) {
        destBatch.qtyOnHand = (Number(destBatch.qtyOnHand) + quantity).toString();
        destBatch.updatedBy = request.user?.sub ?? null;
        destBatch = await this.batches.save(destBatch);
      } else {
        destBatch = await this.batches.save(
          this.batches.create({
            item,
            location: destinationLocation,
            batchNo: null,
            expiryDate: null,
            qtyOnHand: quantity.toString(),
            createdBy: request.user?.sub ?? null,
            updatedBy: request.user?.sub ?? null,
          }),
        );
      }
    }

    const transaction = await this.transactions.save(
      this.transactions.create({
        item,
        batch: destBatch,
        sourceLocation: sourceBatch.location,
        destinationLocation,
        quantity: quantity.toString(),
        unit: item.unit,
        transactionType: params.transactionType,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        reason: params.reason,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );

    return { batch: destBatch, transaction };
  }

  private allocateFromBatches(
    batches: InventoryBatch[],
    quantity: number,
  ): Array<{ batch: InventoryBatch; quantity: number }> {
    let remaining = quantity;
    const allocations: Array<{ batch: InventoryBatch; quantity: number }> = [];
    for (const batch of batches) {
      const available = Number(batch.qtyOnHand);
      if (available <= 0) continue;
      const take = Math.min(available, remaining);
      allocations.push({ batch, quantity: take });
      remaining -= take;
      if (remaining <= 0) break;
    }
    if (remaining > 0) {
      throw new BadRequestException('Insufficient stock to fulfill requisition');
    }
    return allocations;
  }

  private routeFulfillment(category: InventoryCategory): RequisitionFulfillmentRoute {
    return category === 'pharmaceutical' ? 'pharmacy' : 'main_store';
  }

  private async requireLocationCode(code: string) {
    const location = await this.locations.findOne({ where: { code, active: true } });
    if (!location) {
      throw new NotFoundException(`Location not configured: ${code}`);
    }
    return location;
  }

  private async nextRequisitionNo() {
    const year = new Date().getFullYear();
    const count = await this.requisitions.count();
    return `REQ-${year}-${String(count + 1).padStart(5, '0')}`;
  }
}
