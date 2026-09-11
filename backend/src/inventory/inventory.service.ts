import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { ClinicalOrderMirrorService } from '../clinical-order/clinical-order-mirror.service';
import { ClinicalOrder } from '../clinical-order/clinical-order.entities';
import { TenantSettings } from '../core/core.entities';
import {
  CreateInventoryItemDto,
  CreateRequisitionDto,
  CreateTransferDto,
  DispenseOtcDto,
  DispensePharmacyDto,
  ImportInventoryCsvDto,
  ReceiveStockDto,
  UpdateItemPricingDto,
} from './inventory.dto';
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
  private reorderColumnsReady: boolean | null = null;

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
    @InjectRepository(TenantSettings)
    private readonly settings: Repository<TenantSettings>,
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

  async listItems(params?: { category?: InventoryItem['category']; request?: RequestContext }) {
    const rows = await this.items.find({
      where: {
        active: true,
        ...(params?.category ? { category: params.category } : {}),
      },
      order: { name: 'ASC' },
    });
    const pricing = await this.readPricingMap(params?.request);
    return rows.map((item) => {
      const price = pricing[item.sku] ?? { cost: 0, markup: 0, sell: 0 };
      return { ...item, cost: price.cost, markup: price.markup, sell: price.sell };
    });
  }

  async createItem(dto: CreateInventoryItemDto, request: RequestContext) {
    const existing = await this.items.findOne({ where: { sku: dto.sku.trim().toUpperCase() } });
    if (existing) {
      throw new BadRequestException('SKU already exists');
    }
    const trackBatch =
      dto.trackBatch ?? dto.category === 'pharmaceutical';
    const canStoreReorder = await this.hasReorderColumns();
    return this.items.save(
      this.items.create({
        sku: dto.sku.trim().toUpperCase(),
        name: dto.name.trim(),
        category: dto.category,
        unit: dto.unit.trim(),
        trackBatch,
        active: true,
        ...(canStoreReorder
          ? {
              minLevel: dto.minLevel != null ? String(dto.minLevel) : null,
              maxLevel: dto.maxLevel != null ? String(dto.maxLevel) : null,
            }
          : {}),
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async listLowStock() {
    if (!(await this.hasReorderColumns())) {
      return [];
    }
    const items = await this.items
      .createQueryBuilder('item')
      .addSelect('item.minLevel')
      .addSelect('item.maxLevel')
      .where('item.active = :active', { active: true })
      .andWhere('item.deletedAt IS NULL')
      .getMany();
    const batches = await this.batches.find({ relations: { item: true, location: true } });
    return items
      .map((item) => {
        const min = item.minLevel != null ? Number(item.minLevel) : null;
        const qty = batches
          .filter((batch) => batch.item.id === item.id)
          .reduce((sum, batch) => sum + Number(batch.qtyOnHand), 0);
        return {
          ...item,
          qtyOnHand: qty,
          belowMinimum: min != null && Number.isFinite(min) && qty < min,
        };
      })
      .filter((row) => row.belowMinimum);
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
    return this.items.manager.transaction(async (manager) => {
      const orders = manager.getRepository(ClinicalOrder);
      const items = manager.getRepository(InventoryItem);
      const locations = manager.getRepository(InventoryLocation);
      const batchesRepo = manager.getRepository(InventoryBatch);
      const ledger = manager.getRepository(InventoryTransaction);

      const order = await orders.findOne({
        where: { id: dto.clinicalOrderId, orderType: 'pharmacy' },
        relations: { patient: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        throw new NotFoundException('Pharmacy order not found');
      }
      if (order.status === 'dispensed') {
        throw new BadRequestException('This prescription is already dispensed.');
      }
      if (order.status === 'cancelled') {
        throw new BadRequestException('This prescription was cancelled.');
      }

      const pharmacy = await locations.findOne({ where: { code: 'PHARMACY', active: true } });
      if (!pharmacy) {
        throw new NotFoundException('Pharmacy location not configured');
      }

      const item = await this.resolvePharmacyItem(items, order, dto.itemId);
      const quantity = this.resolveDispenseQuantity(dto.quantity, order);
      const batches = await batchesRepo.find({
        where: {
          item: { id: item.id },
          location: { id: pharmacy.id },
          qtyOnHand: MoreThan('0'),
        },
        relations: { item: true, location: true },
        order: { expiryDate: 'ASC', createdAt: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });

      const available = batches.reduce((sum, batch) => sum + Number(batch.qtyOnHand), 0);
      const allocations = this.allocateFromBatches(
        batches,
        quantity,
        `Insufficient pharmacy stock for ${item.name}. Need ${quantity} ${item.unit}, have ${available}.`,
      );

      const ledgerRows: InventoryTransaction[] = [];
      for (const { batch, quantity: take } of allocations) {
        batch.qtyOnHand = (Number(batch.qtyOnHand) - take).toString();
        batch.updatedBy = request.user?.sub ?? null;
        await batchesRepo.save(batch);
        ledgerRows.push(
          await ledger.save(
            ledger.create({
              item,
              batch,
              sourceLocation: pharmacy,
              destinationLocation: null,
              quantity: (-take).toString(),
              unit: item.unit,
              transactionType: 'DISPENSE',
              referenceType: 'clinical_order',
              referenceId: order.id,
              reason: `Dispense ${order.orderNo} — ${item.name}`,
              createdBy: request.user?.sub ?? null,
              updatedBy: request.user?.sub ?? null,
            }),
          ),
        );
      }

      order.status = 'dispensed';
      order.completedAt = new Date();
      order.updatedBy = request.user?.sub ?? null;
      order.metadata = {
        ...(order.metadata ?? {}),
        itemId: item.id,
        dispensedItemId: item.id,
        dispensedItemName: item.name,
        dispensedQuantity: quantity,
        dispensedAt: new Date().toISOString(),
        allocations: allocations.map(({ batch, quantity: take }) => ({
          batchId: batch.id,
          batchNo: batch.batchNo,
          quantity: take,
        })),
      };
      await orders.save(order);

      return {
        orderId: order.id,
        orderNo: order.orderNo,
        item: { id: item.id, name: item.name, sku: item.sku, unit: item.unit },
        quantity,
        allocations: allocations.map(({ batch, quantity: take }) => ({
          batchId: batch.id,
          batchNo: batch.batchNo,
          quantity: take,
        })),
        transactions: ledgerRows,
      };
    });
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

    const allocations = this.allocateFromBatches(
      batches,
      dto.quantity,
      `Insufficient pharmacy stock for ${item.name}.`,
    );
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

  private resolveDispenseQuantity(requested: number | undefined, order: ClinicalOrder) {
    const fromScript = Number(order.metadata?.quantity);
    const quantity = requested ?? (Number.isFinite(fromScript) && fromScript > 0 ? fromScript : undefined);
    if (quantity == null || !Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException('Enter how many units to issue.');
    }
    return quantity;
  }

  private async resolvePharmacyItem(
    items: Repository<InventoryItem>,
    order: ClinicalOrder,
    itemId?: string,
  ) {
    if (itemId) {
      const selected = await items.findOne({ where: { id: itemId, active: true } });
      if (!selected) {
        throw new BadRequestException('Selected stock item was not found.');
      }
      if (selected.category !== 'pharmaceutical') {
        throw new BadRequestException('Dispense only pharmaceutical items from pharmacy.');
      }
      return selected;
    }

    const prescribedId = typeof order.metadata?.itemId === 'string' ? order.metadata.itemId : '';
    if (prescribedId) {
      const linked = await items.findOne({ where: { id: prescribedId, active: true } });
      if (linked) return linked;
    }

    const name = String(order.metadata?.medication ?? '').trim();
    if (!name) {
      throw new BadRequestException('This prescription has no medication name. Select the stock item to issue.');
    }

    const catalog = await items.find({
      where: { active: true, category: 'pharmaceutical' },
      order: { name: 'ASC' },
    });
    const needle = this.normalizeMedName(name);
    const exact = catalog.find(
      (row) => this.normalizeMedName(row.name) === needle || this.normalizeMedName(row.sku) === needle,
    );
    if (exact) return exact;

    const partial = catalog.filter((row) => {
      const hay = this.normalizeMedName(row.name);
      return hay.includes(needle) || needle.includes(hay);
    });
    if (partial.length === 1) return partial[0];
    if (partial.length > 1) {
      throw new BadRequestException(
        `Several stock items match "${name}". Select the exact item on the dispense form.`,
      );
    }
    throw new BadRequestException(
      `No pharmacy stock item matches "${name}". Select the item to issue.`,
    );
  }

  private normalizeMedName(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  private allocateFromBatches(
    batches: InventoryBatch[],
    quantity: number,
    insufficientMessage = 'Insufficient stock to fulfill this request.',
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
      throw new BadRequestException(insufficientMessage);
    }
    return allocations;
  }

  async updateItemPricing(itemId: string, dto: UpdateItemPricingDto, request: RequestContext) {
    const item = await this.items.findOne({ where: { id: itemId, active: true } });
    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }
    const current = (await this.readPricingMap(request))[item.sku] ?? { cost: 0, markup: 0, sell: 0 };
    const next = resolvePrice({
      cost: dto.cost ?? current.cost,
      markup: dto.markup ?? current.markup,
      sell: dto.sell ?? current.sell,
      preferSell: dto.sell != null && dto.markup == null,
    });
    await this.writePricing(item.sku, next, request);
    return { ...item, ...next };
  }

  async importCatalog(dto: ImportInventoryCsvDto, request: RequestContext) {
    const rows = parseInventoryCsv(dto.csv);
    if (!rows.length) {
      throw new BadRequestException('CSV is empty or missing a header row.');
    }
    const summary = { created: 0, updated: 0, received: 0, priced: 0, errors: [] as string[] };
    const defaultLocation = dto.locationId
      ? await this.locations.findOne({ where: { id: dto.locationId, active: true } })
      : null;
    if (dto.locationId && !defaultLocation) {
      throw new BadRequestException('Receive location was not found.');
    }

    for (const [index, row] of rows.entries()) {
      const line = index + 2;
      const sku = (row.sku ?? '').trim().toUpperCase();
      const name = (row.name ?? '').trim();
      if (!sku || !name) {
        summary.errors.push(`Line ${line}: sku and name are required.`);
        continue;
      }
      const category = normalizeInventoryCategory(row.category);
      try {
        let item = await this.items.findOne({ where: { sku } });
        if (!item) {
          item = await this.items.save(
            this.items.create({
              sku,
              name,
              category,
              unit: (row.unit ?? 'unit').trim() || 'unit',
              trackBatch: parseBool(row.track_batch) ?? category === 'pharmaceutical',
              active: true,
              createdBy: request.user?.sub ?? null,
              updatedBy: request.user?.sub ?? null,
            }),
          );
          summary.created += 1;
        } else {
          item.name = name;
          item.category = category;
          item.unit = (row.unit ?? item.unit).trim() || item.unit;
          if (row.track_batch != null && row.track_batch !== '') {
            item.trackBatch = parseBool(row.track_batch) ?? item.trackBatch;
          }
          item.updatedBy = request.user?.sub ?? null;
          item = await this.items.save(item);
          summary.updated += 1;
        }

        const cost = Number(row.cost ?? row.cost_price ?? '');
        const sell = Number(row.sell ?? row.selling_price ?? '');
        const markup = Number(row.markup ?? row.markup_percent ?? '');
        if ([cost, sell, markup].some((value) => Number.isFinite(value) && value !== 0) || row.sell === '0') {
          const price = resolvePrice({
            cost: Number.isFinite(cost) ? cost : 0,
            markup: Number.isFinite(markup) ? markup : 0,
            sell: Number.isFinite(sell) ? sell : 0,
            preferSell: Number.isFinite(sell) && sell > 0,
          });
          await this.writePricing(sku, price, request);
          summary.priced += 1;
        }

        const qty = Number(row.opening_qty ?? row.quantity ?? '');
        if (Number.isFinite(qty) && qty > 0) {
          const location =
            defaultLocation ??
            (await this.locations.findOne({
              where: {
                code: category === 'pharmaceutical' ? 'PHARMACY' : 'MAIN_STORE',
                active: true,
              },
            }));
          if (!location) {
            summary.errors.push(`Line ${line}: no location for opening quantity.`);
            continue;
          }
          await this.receiveStock(
            {
              itemId: item.id,
              locationId: location.id,
              quantity: qty,
              batchNo: row.batch_no?.trim() || undefined,
              expiryDate: row.expiry || row.expiry_date || undefined,
              reason: `CSV import ${sku}`,
            },
            request,
          );
          summary.received += 1;
        }
      } catch (error) {
        summary.errors.push(`Line ${line}: ${error instanceof Error ? error.message : 'import failed'}`);
      }
    }

    return summary;
  }

  private async readPricingMap(request?: RequestContext): Promise<Record<string, ItemPrice>> {
    const settings = await this.loadSettings(request);
    const raw = (settings?.clinicalCatalog as { inventoryPricing?: Record<string, ItemPrice> } | undefined)
      ?.inventoryPricing;
    return raw && typeof raw === 'object' ? raw : {};
  }

  private async writePricing(sku: string, price: ItemPrice, request: RequestContext) {
    const settings = await this.loadSettings(request);
    if (!settings) {
      throw new BadRequestException('Hospital settings are missing — cannot save prices.');
    }
    const catalog = { ...(settings.clinicalCatalog ?? {}) } as Record<string, unknown>;
    const pricing = {
      ...((catalog.inventoryPricing as Record<string, ItemPrice> | undefined) ?? {}),
      [sku]: price,
    };
    catalog.inventoryPricing = pricing;
    await this.settings.update(settings.id, {
      clinicalCatalog: catalog as never,
      updatedBy: request.user?.sub ?? null,
    });
  }

  private async loadSettings(request?: RequestContext) {
    const tenantId = request?.tenant?.id;
    if (!tenantId) return null;
    return this.settings.findOne({ where: { tenant: { id: tenantId } } });
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

  private async hasReorderColumns() {
    if (this.reorderColumnsReady != null) {
      return this.reorderColumnsReady;
    }
    const rows = (await this.items.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'demo'
          AND table_name = 'inventory_items'
          AND column_name IN ('min_level', 'max_level')`,
    )) as Array<{ column_name: string }>;
    this.reorderColumnsReady = rows.length === 2;
    return this.reorderColumnsReady;
  }
}

type ItemPrice = { cost: number; markup: number; sell: number };

function resolvePrice(input: ItemPrice & { preferSell?: boolean }): ItemPrice {
  const cost = Number.isFinite(input.cost) ? Math.max(0, input.cost) : 0;
  let markup = Number.isFinite(input.markup) ? input.markup : 0;
  let sell = Number.isFinite(input.sell) ? Math.max(0, input.sell) : 0;
  if (input.preferSell && sell > 0 && cost > 0) {
    markup = ((sell - cost) / cost) * 100;
  } else if (cost > 0 && (sell <= 0 || !input.preferSell)) {
    sell = Math.round(cost * (1 + markup / 100) * 100) / 100;
  }
  return {
    cost: Math.round(cost * 100) / 100,
    markup: Math.round(markup * 100) / 100,
    sell: Math.round(sell * 100) / 100,
  };
}

function normalizeInventoryCategory(value?: string): InventoryCategory {
  const raw = (value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  if (raw === 'pharmaceutical' || raw === 'pharmacy' || raw === 'medicine' || raw === 'drug') {
    return 'pharmaceutical';
  }
  if (raw === 'medical_consumable' || raw === 'consumable' || raw === 'consumables') {
    return 'medical_consumable';
  }
  return 'non_medical';
}

function parseBool(value?: string) {
  const raw = (value ?? '').trim().toLowerCase();
  if (!raw) return undefined;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y';
}

function parseInventoryCsv(csv: string): Array<Record<string, string>> {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((header) => header.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? '').trim();
    });
    return row;
  });
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}
