import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { domainBadRequest, domainConflict, domainNotFound } from '../common/errors/domain-exception';
import { ERROR_CODES } from '../common/errors/error-codes';
import { chargesEnabled } from '../payments/charge.entities';
import { evaluatePharmacyClearance } from '../payments/pharmacy-clearance';
import { availableQuantity, assertEnoughAvailable } from './stock-available';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { ClinicalOrderMirrorService } from '../clinical-order/clinical-order-mirror.service';
import { ClinicalOrder } from '../clinical-order/clinical-order.entities';
import {
  dispensedQuantity,
  prescribedQuantity,
  prescriptionGroupId,
  remainingQuantity,
} from '../clinical-order/pharmacy-prescription';
import { classifyDrug } from './drug-class';
import { classifyInventoryMatch, likelyNameMatch, normalizeProductName } from './inventory-import-match';
import { TenantSettings } from '../core/core.entities';
import { PaymentsService } from '../payments/payments.service';
import { lookupCatalogueTariff, readHospitalChargeCatalogue } from '../payments/hospital-charges';
import {
  BulkPricingDto,
  CountStockTakeLineDto,
  CreateInventoryItemDto,
  CreateRequisitionDto,
  CreateStockTakeSessionDto,
  CreateTransferDto,
  CancelPharmacySaleDto,
  DispenseOtcDto,
  DispensePharmacyDto,
  DispensePrescriptionDto,
  PrepareOtcCartDto,
  PreparePrescriptionDto,
  ImportInventoryCsvDto,
  ImportStockTakeCountsDto,
  ReceiveStockDto,
  RejectStockTakeDto,
  UpdateItemPricingDto,
} from './inventory.dto';
import {
  assertCanCount,
  assertCanReject,
  assertCanSubmit,
  assertIndependentApprover,
  assertVarianceReason,
} from './stock-take-session';
import {
  csvEscape,
  ledgerNetQuantity,
  proposedSellPrice,
  resolveStockImportIntent,
  roundQty,
  stockVariance,
  summarizeVariances,
  varianceValue,
} from './stock-integrity';
import {
  ADVISORY_LOCK_NAMESPACE,
  IMPORT_RECEIPT_REFERENCE_TYPE,
  MANUAL_RECEIPT_REFERENCE_TYPE,
  STOCK_TAKE_REFERENCE_TYPE,
  assertFreshSnapshot,
  dispenseOperationId,
  duplicateImportSessionMessage,
  importLedgerReferenceType,
  importSessionReferenceId,
  otcSaleReferenceId,
  isUndefinedFunction,
  isUndefinedTable,
  isUniqueViolation,
  nextOnHand,
  sortStockLockKeys,
} from './stock-posting';
import {
  InventoryBatch,
  InventoryItem,
  InventoryLocation,
  InventoryRequisition,
  InventoryRequisitionLine,
  InventoryTransaction,
  InventoryReservation,
  InventoryStockTakeLine,
  InventoryStockTakeSession,
  InventoryTransfer,
  InventoryTransferLine,
  type InventoryCategory,
  type RequisitionFulfillmentRoute,
} from './inventory.entities';

@Injectable()
export class InventoryService {
  private reorderColumnsReady: boolean | null = null;
  /** Test-only failure injection. Never exposed on HTTP DTOs. */
  failNextImportWrite?: 'catalogue' | 'adjust' | 'ledger' | 'charge';

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
    @InjectRepository(InventoryReservation)
    private readonly reservations: Repository<InventoryReservation>,
    @InjectRepository(InventoryStockTakeSession)
    private readonly stockTakeSessions: Repository<InventoryStockTakeSession>,
    @InjectRepository(InventoryStockTakeLine)
    private readonly stockTakeLines: Repository<InventoryStockTakeLine>,
    @InjectRepository(ClinicalOrder)
    private readonly clinicalOrders: Repository<ClinicalOrder>,
    @InjectRepository(TenantSettings)
    private readonly settings: Repository<TenantSettings>,
    private readonly clinicalOrderMirror: ClinicalOrderMirrorService,
    private readonly payments: PaymentsService,
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

  async listItems(params?: {
    category?: InventoryItem['category']
    includeInactive?: boolean
    request?: RequestContext
  }) {
    const qb = this.items
      .createQueryBuilder('item')
      .orderBy('item.name', 'ASC');
    if (params?.category) qb.andWhere('item.category = :category', { category: params.category });
    if (!params?.includeInactive) qb.andWhere('item.active = true');
    if (await this.hasStrengthColumns()) {
      qb.addSelect('item.strength').addSelect('item.dosageForm');
    }
    if (await this.hasReorderColumns()) {
      qb.addSelect('item.minLevel').addSelect('item.maxLevel');
    }
    const rows = await qb.getMany();
    const pricing = await this.readPricingMap(params?.request);
    return rows.map((item) => {
      const price = pricing[item.sku] ?? { cost: 0, markup: 0, sell: 0 };
      const drugClass = item.drugClass ?? classifyDrug(item.name, item.category);
      return {
        ...item,
        ...price,
        drugClass,
        strength: item.strength ?? null,
        dosageForm: item.dosageForm ?? null,
        minLevel: item.minLevel != null ? Number(item.minLevel) : null,
        maxLevel: item.maxLevel != null ? Number(item.maxLevel) : null,
      };
    });
  }

  async lookupByBarcode(code: string, request?: RequestContext) {
    const scanned = code.trim();
    if (!scanned) throw new BadRequestException('Barcode is required');
    const skuMatch = await this.items.findOne({
      where: { sku: scanned.toUpperCase(), active: true },
    });
    const batchMatches = await this.batches.find({
      where: { batchNo: scanned },
      relations: { item: true, location: true },
      take: 20,
    });
    const item = skuMatch ?? batchMatches[0]?.item ?? null;
    if (!item) {
      throw new NotFoundException('No product or batch matches this barcode. Check SKU or batch number.');
    }
    const batches = skuMatch
      ? await this.batches.find({
          where: { item: { id: item.id } },
          relations: { location: true },
          order: { expiryDate: 'ASC' },
        })
      : batchMatches.filter((row) => row.item?.id === item.id);
    const pricing = await this.readPricingMap(request);
    const price = pricing[item.sku] ?? { cost: 0, markup: 0, sell: 0 };
    return {
      match: skuMatch ? 'sku' : 'batch',
      item: { ...item, ...price },
      batches: batches.map((batch) => ({
        id: batch.id,
        batchNo: batch.batchNo,
        expiryDate: batch.expiryDate,
        qtyOnHand: batch.qtyOnHand,
        locationId: batch.location?.id ?? null,
        locationName: batch.location?.name ?? null,
        expired: batch.expiryDate ? batch.expiryDate < new Date().toISOString().slice(0, 10) : false,
      })),
    };
  }

  async createItem(dto: CreateInventoryItemDto, request: RequestContext) {
    const existing = await this.items.findOne({ where: { sku: dto.sku.trim().toUpperCase() } });
    if (existing) {
      throw new BadRequestException('SKU already exists');
    }
    const trackBatch =
      dto.trackBatch ?? dto.category === 'pharmaceutical';
    const canStoreReorder = await this.hasReorderColumns();
    const canStoreStrength = await this.hasStrengthColumns();
    return this.items.save(
      this.items.create({
        sku: dto.sku.trim().toUpperCase(),
        name: dto.name.trim(),
        category: dto.category,
        drugClass: classifyDrug(dto.name, dto.category),
        unit: dto.unit.trim(),
        trackBatch,
        active: true,
        ...(canStoreStrength
          ? {
              strength: dto.strength?.trim() || null,
              dosageForm: dto.dosageForm?.trim() || null,
            }
          : {}),
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

  async updateItem(
    itemId: string,
    dto: {
      name?: string;
      unit?: string;
      strength?: string;
      dosageForm?: string;
      active?: boolean;
      minLevel?: number;
      maxLevel?: number;
    },
    request: RequestContext,
  ) {
    const item = await this.items.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Catalogue product not found');
    if (dto.name != null && dto.name.trim()) {
      item.name = dto.name.trim();
      item.drugClass = classifyDrug(item.name, item.category);
    }
    if (dto.unit != null && dto.unit.trim()) item.unit = dto.unit.trim();
    if (dto.active != null) item.active = dto.active;
    if (await this.hasStrengthColumns()) {
      if (dto.strength !== undefined) item.strength = dto.strength.trim() || null;
      if (dto.dosageForm !== undefined) item.dosageForm = dto.dosageForm.trim() || null;
    }
    if (await this.hasReorderColumns()) {
      if (dto.minLevel !== undefined) item.minLevel = dto.minLevel != null ? String(dto.minLevel) : null;
      if (dto.maxLevel !== undefined) item.maxLevel = dto.maxLevel != null ? String(dto.maxLevel) : null;
    }
    item.updatedBy = request.user?.sub ?? null;
    return this.items.save(item);
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
    const onHand = batches.filter((batch) => Number(batch.qtyOnHand) > 0);
    const held = await this.reservations.find({
      where: { location: { id: locationId }, status: 'held' },
      relations: { batch: true, item: true },
    });
    const heldByBatch = new Map<string, number>();
    for (const row of held) {
      heldByBatch.set(row.batch.id, (heldByBatch.get(row.batch.id) ?? 0) + Number(row.quantity));
    }
    return {
      location,
      batches: onHand.map((batch) => {
        const reserved = heldByBatch.get(batch.id) ?? 0;
        const onHandQty = Number(batch.qtyOnHand);
        return {
          ...batch,
          reservedQuantity: reserved,
          availableQuantity: Math.max(0, onHandQty - reserved),
        };
      }),
    };
  }

  async receiveStock(dto: ReceiveStockDto, request: RequestContext) {
    return this.items.manager.transaction((manager) => this.receiveStockIn(manager, dto, request));
  }

  private async receiveStockIn(
    manager: EntityManager,
    dto: ReceiveStockDto,
    request: RequestContext,
    importSessionKey?: string | null,
  ) {
    const items = manager.getRepository(InventoryItem);
    const locations = manager.getRepository(InventoryLocation);
    const batchesRepo = manager.getRepository(InventoryBatch);
    const ledger = manager.getRepository(InventoryTransaction);
    const item = await items.findOne({ where: { id: dto.itemId, active: true } });
    if (!item) {
      throw new NotFoundException('Item not found');
    }
    const location = await locations.findOne({ where: { id: dto.locationId, active: true } });
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
    if (dto.expiryDate && isExpiredBatch(dto.expiryDate)) {
      throw new BadRequestException(
        'Expired stock cannot be received as usable inventory. Record it as a write-off after a stock-take.',
      );
    }

    const qty = dto.quantity.toString();
    const lot = item.trackBatch ? dto.batchNo!.trim() : null;
    await this.lockItem(manager, item.id);
    let batch = await this.lockMatchingBatch(manager, item.id, location.id, lot);
    if (batch) {
      batch.qtyOnHand = nextOnHand(Number(batch.qtyOnHand), dto.quantity).toString();
      batch.updatedBy = request.user?.sub ?? null;
      batch = await batchesRepo.save(batch);
    } else {
      batch = await batchesRepo.save(
        batchesRepo.create({
          item,
          location,
          batchNo: lot,
          expiryDate: item.trackBatch ? (dto.expiryDate ?? null) : null,
          qtyOnHand: qty,
          createdBy: request.user?.sub ?? null,
          updatedBy: request.user?.sub ?? null,
        }),
      );
    }

    const transaction = await ledger.save(
      ledger.create({
        item,
        batch,
        sourceLocation: null,
        destinationLocation: location,
        quantity: qty,
        unit: item.unit,
        transactionType: 'RECEIPT',
        referenceType: importSessionKey ? IMPORT_RECEIPT_REFERENCE_TYPE : MANUAL_RECEIPT_REFERENCE_TYPE,
        referenceId: importSessionKey ? importSessionReferenceId(importSessionKey) : batch.id,
        reason: dto.reason?.trim() || null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );

    return { batch, transaction };
  }

  async dispensePharmacyOrder(
    dto: DispensePharmacyDto,
    request: RequestContext,
    manager?: EntityManager,
  ) {
    if (!manager) {
      return this.items.manager.transaction(async (txn) => {
        const result = await this.issuePharmacyLine(dto, request, txn);
        await this.recordDispenseCharge(result.billing, request, txn, [
          { orderId: result.orderId, quantity: result.quantity },
        ]);
        return result;
      });
    }
    return this.issuePharmacyLine(dto, request, manager);
  }

  private async issuePharmacyLine(
    dto: DispensePharmacyDto,
    request: RequestContext,
    manager: EntityManager,
  ) {
      const orders = manager.getRepository(ClinicalOrder);
      const items = manager.getRepository(InventoryItem);
      const locations = manager.getRepository(InventoryLocation);
      const batchesRepo = manager.getRepository(InventoryBatch);
      const ledger = manager.getRepository(InventoryTransaction);

      await orders.findOne({
        where: { id: dto.clinicalOrderId, orderType: 'pharmacy' },
        lock: { mode: 'pessimistic_write' },
      });
      const order = await orders.findOne({
        where: { id: dto.clinicalOrderId, orderType: 'pharmacy' },
        relations: { patient: true, encounter: true, admission: true },
      });
      if (!order) {
        throw new NotFoundException('Pharmacy order not found');
      }
      if (order.metadata?.kind === 'prescription') {
        throw new BadRequestException('Dispense the medication lines, not the prescription header.');
      }
      if (order.status === 'cancelled') {
        throw new BadRequestException('This prescription was cancelled.');
      }
      const remaining = remainingQuantity(order);
      if (order.status === 'dispensed' || remaining === 0) {
        throw new BadRequestException('This prescription line is already fully dispensed.');
      }

      const pharmacy = await locations.findOne({ where: { code: 'PHARMACY', active: true } });
      if (!pharmacy) {
        throw new NotFoundException('Pharmacy location not configured');
      }

      const item = await this.resolvePharmacyItem(items, order, dto.itemId);
      const quantity = this.resolveDispenseQuantity(dto.quantity, order, remaining);
      await this.assertReservationsReady(manager);
      const saleId = prescriptionGroupId(order);
      await this.assertPharmacyClearance(saleId, manager);
      await this.lockLocationBatches(manager, item.id, pharmacy.id);
      const held = await this.heldReservations(manager, saleId, order.id);
      if (!held.length) {
        throw domainConflict(
          ERROR_CODES.SALE_NOT_PREPARED,
          'This prescription line has not been prepared. Reserve stock and send the bill to cashier first.',
        );
      }
      const allocations = await this.consumeReservations(manager, held, quantity, request);

      const ledgerRows: InventoryTransaction[] = [];
      for (const { batch, quantity: take } of allocations) {
        batch.qtyOnHand = nextOnHand(Number(batch.qtyOnHand), -take).toString();
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

      const previousAllocations = Array.isArray(order.metadata?.allocations)
        ? (order.metadata?.allocations as Array<Record<string, unknown>>)
        : [];
      const nextDispensed = dispensedQuantity(order) + quantity;
      const prescribed = prescribedQuantity(order);
      const fullyDispensed = prescribed > 0 ? nextDispensed >= prescribed : true;
      order.status = fullyDispensed ? 'dispensed' : 'partially_dispensed';
      order.completedAt = fullyDispensed ? new Date() : order.completedAt;
      order.updatedBy = request.user?.sub ?? null;
      order.metadata = {
        ...(order.metadata ?? {}),
        itemId: item.id,
        dispensedItemId: item.id,
        dispensedItemName: item.name,
        dispensedQuantity: nextDispensed,
        quantityDispensed: nextDispensed,
        dispensedAt: new Date().toISOString(),
        billingStatus: 'awaiting_charge',
        allocations: [
          ...previousAllocations,
          ...allocations.map(({ batch, quantity: take }) => ({
            batchId: batch.id,
            batchNo: batch.batchNo,
            quantity: take,
          })),
        ],
      };
      await orders.save(order);
      await this.syncPrescriptionHeader(orders, order);

      const pricing = await this.readPricingMap(request);
      let unitSell = Number(pricing[item.sku]?.sell ?? 0);
      if (!(unitSell > 0)) {
        const settings = await this.loadSettings(request);
        const catalogue = readHospitalChargeCatalogue((settings?.clinicalCatalog as Record<string, unknown>) ?? null);
        unitSell =
          lookupCatalogueTariff(catalogue.items, {
            code: item.sku,
            name: item.name,
            category: 'pharmacy',
          }) ?? 0;
      }
      const suggestedAmount =
        Number.isFinite(unitSell) && unitSell > 0
          ? Math.round(unitSell * quantity * 100) / 100
          : null;
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
        billing: {
          serviceLine: 'pharmacy',
          serviceEntityId: prescriptionGroupId(order),
          lineId: order.id,
          patientId: order.patient.id,
          encounterId: order.encounter?.id ?? null,
          admissionId: order.admission?.id ?? null,
          description: `${item.name} × ${quantity} ${item.unit}`,
          suggestedAmount,
        },
      };
  }

  /**
   * Physical OTC issue. Stock leaves the shelf only after financial clearance.
   * Prepare the sale first so a reservation and charge exist.
   */
  async issueOtcSale(dto: DispenseOtcDto, request: RequestContext) {
    const clientSaleId = dto.saleId?.trim();
    if (!clientSaleId) {
      throw domainBadRequest(ERROR_CODES.VALIDATION_ERROR, 'OTC sales require a stable saleId so retries cannot become a second sale.');
    }
    return this.items.manager.transaction(async (manager) => {
      await this.assertReservationsReady(manager);
      const saleRef = otcSaleReferenceId(clientSaleId);
      await this.acquireImportAdvisoryLock(manager, `otc_sale:${saleRef}`);
      const ledger = manager.getRepository(InventoryTransaction);
      const duplicate = await ledger.findOne({
        where: { referenceType: 'otc_sale', referenceId: saleRef },
      });
      if (duplicate) {
        return { saleId: saleRef, replay: true, stockDeducted: false };
      }
      await this.assertPharmacyClearance(saleRef, manager);
      const locations = manager.getRepository(InventoryLocation);
      const pharmacy = await locations.findOne({ where: { code: 'PHARMACY', active: true } });
      if (!pharmacy) throw new NotFoundException('Pharmacy location not configured');
      const held = await this.heldReservations(manager, saleRef);
      if (!held.length) {
        throw domainConflict(
          ERROR_CODES.SALE_NOT_PREPARED,
          'This OTC sale has not been prepared. Reserve stock and bill the patient first.',
        );
      }
      const itemIds = [...new Set(held.map((row) => row.item.id))];
      for (const itemId of itemIds) {
        await this.lockLocationBatches(manager, itemId, pharmacy.id);
      }
      const issueQty = held.reduce((sum, row) => sum + Number(row.quantity), 0);
      const allocations = await this.consumeReservations(manager, held, issueQty, request);
      const batchesRepo = manager.getRepository(InventoryBatch);
      const ledgerRows: InventoryTransaction[] = [];
      for (const { batch, quantity } of allocations) {
        const lineItem = batch.item ?? held.find((row) => row.batch.id === batch.id)?.item;
        if (!lineItem) throw new NotFoundException('Inventory item not found');
        batch.qtyOnHand = nextOnHand(Number(batch.qtyOnHand), -quantity).toString();
        batch.updatedBy = request.user?.sub ?? null;
        await batchesRepo.save(batch);
        ledgerRows.push(
          await ledger.save(
            ledger.create({
              item: lineItem,
              batch,
              sourceLocation: pharmacy,
              destinationLocation: null,
              quantity: (-quantity).toString(),
              unit: lineItem.unit,
              transactionType: 'DISPENSE',
              referenceType: 'otc_sale',
              referenceId: saleRef,
              reason: dto.notes?.trim() || 'OTC sale',
              createdBy: request.user?.sub ?? null,
              updatedBy: request.user?.sub ?? null,
            }),
          ),
        );
      }
      return {
        item: allocations[0]?.batch.item ?? held[0]?.item,
        patientId: dto.patientId ?? null,
        saleId: saleRef,
        allocations: allocations.map(({ batch, quantity }) => ({
          batchId: batch.id,
          batchNo: batch.batchNo,
          quantity,
        })),
        transactions: ledgerRows,
        replay: false,
      };
    });
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
    return this.items.manager.transaction(async (manager) => {
      const requisitions = manager.getRepository(InventoryRequisition);
      await requisitions.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      const requisition = await requisitions.findOne({
        where: { id },
        relations: {
          destinationLocation: true,
          lines: { item: true, sourceLocation: true },
        },
      });
      if (!requisition) throw new NotFoundException('Requisition not found');
      if (requisition.status !== 'approved') {
        throw new BadRequestException(
          requisition.status === 'issued' || requisition.status === 'completed'
            ? 'This requisition was already issued. Stock was not moved again.'
            : 'Requisition must be approved before issue',
        );
      }
      if (!requisition.destinationLocation) {
        throw new BadRequestException('Requisition has no destination location');
      }

      const itemIds = [...new Set(requisition.lines.map((line) => line.item.id))].sort();
      for (const itemId of itemIds) await this.lockItem(manager, itemId);

      const ledger = manager.getRepository(InventoryTransaction);
      const linesRepo = manager.getRepository(InventoryRequisitionLine);
      const ledgerRows: InventoryTransaction[] = [];
      for (const line of requisition.lines) {
        if (line.status !== 'pending') continue;
        const qty = Number(line.quantityRequested);
        const batches = await this.lockLocationBatches(manager, line.item.id, line.sourceLocation.id);
        const allocations = this.allocateFromBatches(batches, qty);
        for (const { batch, quantity } of allocations) {
          batch.qtyOnHand = nextOnHand(Number(batch.qtyOnHand), -quantity).toString();
          batch.updatedBy = request.user?.sub ?? null;
          await manager.getRepository(InventoryBatch).save(batch);
          ledgerRows.push(
            await ledger.save(
              ledger.create({
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
            manager,
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
        await linesRepo.save(line);
      }
      requisition.status = 'issued';
      requisition.updatedBy = request.user?.sub ?? null;
      await requisitions.save(requisition);
      return {
        requisition: await this.getRequisition(id),
        transactions: ledgerRows,
      };
    });
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
    return this.items.manager.transaction(async (manager) => {
      const transfers = manager.getRepository(InventoryTransfer);
      await transfers.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      const transfer = await transfers.findOne({
        where: { id },
        relations: {
          sourceLocation: true,
          destinationLocation: true,
          lines: { item: true, batch: true },
        },
      });
      if (!transfer) throw new NotFoundException('Transfer not found');
      if (transfer.status !== 'pending') {
        throw new BadRequestException('Only pending transfers can be shipped');
      }
      const itemIds = [...new Set(transfer.lines.map((line) => line.item.id))].sort();
      for (const itemId of itemIds) await this.lockItem(manager, itemId);
      const ledger = manager.getRepository(InventoryTransaction);
      const linesRepo = manager.getRepository(InventoryTransferLine);
      for (const line of transfer.lines) {
        const qty = Number(line.quantity);
        const batches = await this.lockLocationBatches(
          manager,
          line.item.id,
          transfer.sourceLocation.id,
        );
        const allocations = this.allocateFromBatches(batches, qty);
        for (const { batch, quantity } of allocations) {
          batch.qtyOnHand = nextOnHand(Number(batch.qtyOnHand), -quantity).toString();
          batch.updatedBy = request.user?.sub ?? null;
          await manager.getRepository(InventoryBatch).save(batch);
          await ledger.save(
            ledger.create({
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
        await linesRepo.save(line);
      }
      transfer.status = 'in_transit';
      transfer.updatedBy = request.user?.sub ?? null;
      await transfers.save(transfer);
      return this.getTransfer(id);
    });
  }

  async receiveTransfer(id: string, request: RequestContext) {
    return this.items.manager.transaction(async (manager) => {
      const transfers = manager.getRepository(InventoryTransfer);
      await transfers.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      const transfer = await transfers.findOne({
        where: { id },
        relations: {
          sourceLocation: true,
          destinationLocation: true,
          lines: { item: true },
        },
      });
      if (!transfer) throw new NotFoundException('Transfer not found');
      if (transfer.status !== 'in_transit') {
        throw new BadRequestException('Transfer must be in transit before receive');
      }
      const alreadyIn = await manager.getRepository(InventoryTransaction).find({
        where: {
          referenceType: 'transfer',
          referenceId: transfer.id,
          transactionType: 'TRANSFER_IN',
        },
      });
      if (alreadyIn.length) {
        throw new BadRequestException('This transfer was already received. Stock was not credited again.');
      }
      const outbound = await manager.getRepository(InventoryTransaction).find({
        where: {
          referenceType: 'transfer',
          referenceId: transfer.id,
          transactionType: 'TRANSFER_OUT',
        },
        relations: { item: true, batch: true, sourceLocation: true, destinationLocation: true },
      });
      const shipped = outbound.reduce((sum, row) => sum + Math.abs(Number(row.quantity)), 0);
      if (!(shipped > 0)) {
        throw new BadRequestException('No shipped quantity exists for this transfer.');
      }
      const itemIds = [...new Set(outbound.map((row) => row.item.id))].sort();
      for (const itemId of itemIds) await this.lockItem(manager, itemId);
      for (const txn of outbound) {
        if (txn.sourceLocation?.id !== transfer.sourceLocation.id) {
          throw new BadRequestException('Transfer source location does not match the shipped lots.');
        }
        if (txn.destinationLocation?.id && txn.destinationLocation.id !== transfer.destinationLocation.id) {
          throw new BadRequestException('Transfer destination location does not match the shipped lots.');
        }
        const qty = Math.abs(Number(txn.quantity));
        await this.creditLocationBatch({
          manager,
          item: txn.item,
          sourceBatch: txn.batch!,
          destinationLocation: transfer.destinationLocation,
          quantity: qty,
          transactionType: 'TRANSFER_IN',
          referenceType: 'transfer',
          referenceId: transfer.id,
          reason: `Receive ${transfer.transferNo} at ${transfer.destinationLocation.name}`,
          request,
        });
      }
      const linesRepo = manager.getRepository(InventoryTransferLine);
      for (const line of transfer.lines) {
        line.status = 'received';
        line.updatedBy = request.user?.sub ?? null;
        await linesRepo.save(line);
      }
      transfer.status = 'completed';
      transfer.updatedBy = request.user?.sub ?? null;
      await transfers.save(transfer);
      return this.getTransfer(id);
    });
  }

  private async nextTransferNo() {
    const year = new Date().getFullYear();
    const count = await this.transfers.count();
    return `TRF-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private async creditLocationBatch(params: {
    manager: EntityManager;
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
    const { item, sourceBatch, destinationLocation, quantity, request, manager } = params;
    const batches = manager.getRepository(InventoryBatch);
    const ledger = manager.getRepository(InventoryTransaction);
    await this.lockItem(manager, item.id);
    let destBatch = await this.lockMatchingBatch(
      manager,
      item.id,
      destinationLocation.id,
      sourceBatch.batchNo ?? null,
    );
    if (destBatch) {
      destBatch.qtyOnHand = nextOnHand(Number(destBatch.qtyOnHand), quantity).toString();
      destBatch.updatedBy = request.user?.sub ?? null;
      destBatch = await batches.save(destBatch);
    } else {
      destBatch = await batches.save(
        batches.create({
          item,
          location: destinationLocation,
          batchNo: sourceBatch.batchNo ?? null,
          expiryDate: sourceBatch.batchNo ? sourceBatch.expiryDate : null,
          qtyOnHand: quantity.toString(),
          createdBy: request.user?.sub ?? null,
          updatedBy: request.user?.sub ?? null,
        }),
      );
    }
    const transaction = await ledger.save(
      ledger.create({
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

  private resolveDispenseQuantity(
    requested: number | undefined,
    order: ClinicalOrder,
    remaining?: number | null,
  ) {
    const fromScript = remaining != null && remaining > 0 ? remaining : Number(order.metadata?.quantity);
    const quantity = requested ?? (Number.isFinite(fromScript) && fromScript > 0 ? fromScript : undefined);
    if (quantity == null || !Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException('Enter how many units to issue.');
    }
    if (remaining != null && remaining >= 0 && quantity > remaining) {
      throw new BadRequestException(
        `Cannot dispense ${quantity}. Only ${remaining} remain on this prescription line.`,
      );
    }
    return quantity;
  }

  private async syncPrescriptionHeader(
    orders: Repository<ClinicalOrder>,
    line: ClinicalOrder,
  ) {
    const groupId = prescriptionGroupId(line);
    if (groupId === line.id) return;
    const header = await orders.findOne({ where: { id: groupId, orderType: 'pharmacy' } });
    if (!header || header.metadata?.kind !== 'prescription') return;
    const siblings = await orders.find({
      where: { orderType: 'pharmacy', patient: { id: line.patient.id } },
    });
    const lines = siblings.filter(
      (row) => prescriptionGroupId(row) === groupId && row.metadata?.kind !== 'prescription',
    );
    const allDispensed = lines.every((row) => row.status === 'dispensed' || row.status === 'cancelled');
    const anyIssued = lines.some((row) => dispensedQuantity(row) > 0 || row.status === 'partially_dispensed');
    header.status = allDispensed ? 'dispensed' : anyIssued ? 'partially_dispensed' : 'requested';
    header.completedAt = allDispensed ? new Date() : null;
    await orders.save(header);
  }

  async dispensePrescription(dto: DispensePrescriptionDto, request: RequestContext) {
    if (!dto.confirm) {
      throw new BadRequestException('Confirm dispensing before stock is deducted.');
    }
    if (!dto.lines?.length) {
      throw new BadRequestException('Select at least one medication line to dispense.');
    }
    return this.items.manager.transaction(async (manager) => {
      const results = [];
      for (const line of dto.lines) {
        if (line.rejected) continue;
        results.push(
          await this.dispensePharmacyOrder(
            {
              clinicalOrderId: line.clinicalOrderId,
              itemId: line.itemId,
              quantity: line.quantity,
            },
            request,
            manager,
          ),
        );
      }
      if (!results.length) {
        throw new BadRequestException('No lines were dispensed.');
      }
      const suggestedAmount = results.reduce(
        (sum, row) => sum + (row.billing.suggestedAmount ?? 0),
        0,
      );
      const billing = {
        serviceLine: 'pharmacy' as const,
        serviceEntityId: dto.prescriptionGroupId ?? results[0].billing.serviceEntityId,
        patientId: results[0].billing.patientId,
        encounterId: results[0].billing.encounterId,
        admissionId: results[0].billing.admissionId ?? null,
        description: results.map((row) => row.billing.description).join(' · '),
        suggestedAmount: suggestedAmount > 0 ? Math.round(suggestedAmount * 100) / 100 : null,
        orderNo: results[0].orderNo,
      };
      return {
        prescriptionGroupId: billing.serviceEntityId,
        lines: results,
        billing,
      };
    });
  }

  async retryDispenseBilling(orderId: string, request: RequestContext) {
    return this.items.manager.transaction(async (manager) => {
      const orders = manager.getRepository(ClinicalOrder);
      await orders.findOne({
        where: { id: orderId, orderType: 'pharmacy' },
        lock: { mode: 'pessimistic_write' },
      });
      const order = await orders.findOne({
        where: { id: orderId, orderType: 'pharmacy' },
        relations: { patient: true, encounter: true, admission: true },
      });
      if (!order) throw new NotFoundException('Pharmacy order not found');
      if (order.status !== 'dispensed' && order.status !== 'partially_dispensed') {
        throw new BadRequestException('Stock has not been dispensed for this order.');
      }
      const quantity = dispensedQuantity(order);
      await this.recordDispenseCharge(
        {
          patientId: order.patient.id,
          encounterId: order.encounter?.id ?? null,
          admissionId: order.admission?.id ?? null,
          serviceEntityId: prescriptionGroupId(order),
          description: String(order.metadata?.dispensedItemName ?? order.orderNo),
          suggestedAmount: Number(order.metadata?.suggestedAmount ?? 0) || null,
          orderNo: order.orderNo,
        },
        request,
        manager,
        [{ orderId: order.id, quantity }],
      );
      return { orderId: order.id, retried: true, stockDeducted: false };
    });
  }

  private async recordDispenseCharge(
    billing: {
      patientId: string;
      encounterId: string | null;
      admissionId?: string | null;
      serviceEntityId: string;
      description: string;
      suggestedAmount: number | null;
      orderNo?: string;
    },
    request: RequestContext,
    manager: EntityManager,
    lines: Array<{ orderId: string; quantity: number }>,
  ) {
    const orders = manager.getRepository(ClinicalOrder);
    const mark = async (status: string, extra?: Record<string, unknown>) => {
      for (const line of lines) {
        const order = await orders.findOne({ where: { id: line.orderId } });
        if (!order) continue;
        order.metadata = { ...(order.metadata ?? {}), billingStatus: status, ...extra };
        order.updatedBy = request.user?.sub ?? null;
        await orders.save(order);
      }
    };
    if (billing.suggestedAmount == null || billing.suggestedAmount <= 0) {
      await mark('not_required');
      return;
    }
    const opId = dispenseOperationId({ serviceEntityId: billing.serviceEntityId, lines });
    const charge = await this.payments.upsertPharmacyCharge(
      {
        patientId: billing.patientId,
        encounterId: billing.encounterId,
        admissionId: billing.admissionId ?? null,
        serviceEntityId: billing.serviceEntityId,
        description: billing.description,
        amountDelta: billing.suggestedAmount,
        orderNo: billing.orderNo,
        userId: request.user?.sub ?? null,
        dispenseOpId: opId,
      },
      manager,
    );
    await mark(charge ? 'charged' : 'charges_disabled', {
      chargeId: charge?.id ?? null,
      dispenseOpId: opId,
      suggestedAmount: billing.suggestedAmount,
    });
  }

  private async resolvePharmacyItem(
    items: Repository<InventoryItem>,
    order: ClinicalOrder,
    itemId?: string,
  ) {
    const requested = itemId?.trim() ?? '';
    if (!requested) {
      throw new BadRequestException(
        'Select the exact catalogue product to dispense. Matching a drug by name is not allowed.',
      );
    }

    const selected = await items.findOne({ where: { id: requested, active: true } });
    if (!selected) {
      throw new BadRequestException(
        'The selected catalogue product was not found or is inactive. Choose a current pharmacy product.',
      );
    }
    if (selected.category !== 'pharmaceutical') {
      throw new BadRequestException('Dispense only pharmaceutical items from pharmacy.');
    }

    const prescribedId =
      typeof order.metadata?.itemId === 'string' ? order.metadata.itemId.trim() : '';
    if (prescribedId && prescribedId !== selected.id) {
      throw new BadRequestException(
        'The selected product does not match the prescribed catalogue product. Issue the prescribed item, or ask the prescriber to correct the prescription.',
      );
    }

    return selected;
  }

  /**
   * Reserve FEFO lots and open/update the pharmacy charge. Does not change qty_on_hand
   * and does not post DISPENSE. Safe to retry with the same lines.
   */
  async preparePrescriptionSale(dto: PreparePrescriptionDto, request: RequestContext) {
    if (!dto.lines?.length) {
      throw domainBadRequest(ERROR_CODES.VALIDATION_ERROR, 'Select at least one medication line to prepare.');
    }
    return this.items.manager.transaction(async (manager) => {
      await this.assertReservationsReady(manager);
      const results = [];
      for (const line of dto.lines) {
        if (line.rejected) continue;
        results.push(await this.preparePharmacyLine(line, request, manager));
      }
      if (!results.length) {
        throw domainBadRequest(ERROR_CODES.VALIDATION_ERROR, 'No lines were prepared.');
      }
      const saleId = dto.prescriptionGroupId ?? results[0].saleId;
      const suggestedAmount = results.reduce((sum, row) => sum + (row.suggestedAmount ?? 0), 0);
      await this.postPrepareCharge(
        {
          saleId,
          patientId: results[0].patientId,
          encounterId: results[0].encounterId,
          admissionId: results[0].admissionId,
          description: results.map((row) => row.description).join(' · '),
          suggestedAmount,
          orderNo: results[0].orderNo,
          lines: results.map((row) => ({ orderId: row.orderId, quantity: row.quantity })),
        },
        request,
        manager,
      );
      return { saleId, replay: results.every((row) => row.replay), lines: results };
    });
  }

  async prepareOtcSale(dto: PrepareOtcCartDto | DispenseOtcDto, request: RequestContext) {
    const clientSaleId = dto.saleId?.trim();
    if (!clientSaleId) {
      throw domainBadRequest(ERROR_CODES.VALIDATION_ERROR, 'OTC sales require a stable saleId so retries cannot become a second sale.');
    }
    const rawLines =
      'lines' in dto && Array.isArray(dto.lines) && dto.lines.length
        ? dto.lines
        : 'itemId' in dto && dto.itemId
          ? [{ itemId: dto.itemId, quantity: dto.quantity }]
          : [];
    const lines = rawLines.map((line) => {
      const quantity = Number(line.quantity);
      if (!line.itemId?.trim() || !Number.isFinite(quantity) || quantity <= 0) {
        throw domainBadRequest(ERROR_CODES.VALIDATION_ERROR, 'Each cart line needs a product and a quantity.');
      }
      return { itemId: line.itemId.trim(), quantity };
    });
    if (!lines.length) {
      throw domainBadRequest(ERROR_CODES.VALIDATION_ERROR, 'Add at least one product to the cart.');
    }
    const patientId = dto.patientId?.trim() || null;
    const walkInName = 'walkInName' in dto ? dto.walkInName?.trim() : undefined;
    const walkInPhone = 'walkInPhone' in dto ? dto.walkInPhone?.trim() : undefined;
    return this.items.manager.transaction(async (manager) => {
      await this.assertReservationsReady(manager);
      const saleRef = otcSaleReferenceId(clientSaleId);
      await this.acquireImportAdvisoryLock(manager, `otc_prepare:${saleRef}`);
      const existing = await this.heldReservations(manager, saleRef);
      const opId = dispenseOperationId({
        serviceEntityId: saleRef,
        lines: lines.map((line, index) => ({ orderId: `${saleRef}:${index}`, quantity: line.quantity })),
      });
      if (existing.length && existing.every((row) => row.prepareOpId === opId)) {
        return { saleId: saleRef, replay: true, reservations: existing };
      }
      if (existing.length) {
        throw domainConflict(ERROR_CODES.CONFLICT, 'This OTC sale already has a different reservation. Cancel it before preparing again.');
      }
      const locations = manager.getRepository(InventoryLocation);
      const items = manager.getRepository(InventoryItem);
      const pharmacy = await locations.findOne({ where: { code: 'PHARMACY', active: true } });
      if (!pharmacy) throw new NotFoundException('Pharmacy location not configured');
      const pricing = await this.readPricingMap(request);
      const descriptions: string[] = [];
      let suggested = 0;
      const allReservations = [];
      for (const line of lines) {
        const item = await items.findOne({ where: { id: line.itemId, active: true } });
        if (!item) throw new NotFoundException('Inventory item not found');
        if (item.category !== 'pharmaceutical') {
          throw domainBadRequest(ERROR_CODES.VALIDATION_ERROR, `${item.name} is not a pharmaceutical OTC item.`);
        }
        const batches = await this.lockLocationBatches(manager, item.id, pharmacy.id);
        const allocations = await this.allocateAvailableFromBatches(manager, batches, line.quantity, item.name);
        allReservations.push(
          ...(await this.insertReservations(
            manager,
            allocations.map((row) => ({
              saleId: saleRef,
              clinicalOrderId: null,
              item,
              batch: row.batch,
              location: pharmacy,
              quantity: row.quantity,
              prepareOpId: opId,
            })),
            request,
          )),
        );
        const unitSell = Number(pricing[item.sku]?.sell ?? 0);
        if (!Number.isFinite(unitSell) || unitSell <= 0) {
          throw domainConflict(
            ERROR_CODES.INCONSISTENT_CHARGE,
            `${item.name} has no selling price. Price it in inventory before preparing the sale.`,
          );
        }
        suggested += Math.round(unitSell * line.quantity * 100) / 100;
        descriptions.push(`${item.name} × ${line.quantity} ${item.unit}`);
      }
      await this.postPrepareCharge(
        {
          saleId: saleRef,
          patientId,
          encounterId: null,
          admissionId: null,
          description: descriptions.join(' · '),
          suggestedAmount: Math.round(suggested * 100) / 100,
          orderNo: `OTC-${saleRef.slice(0, 8)}`,
          lines: lines.map((line, index) => ({ orderId: `${saleRef}:${index}`, quantity: line.quantity })),
          walkIn: patientId ? null : { name: walkInName || 'Walk-in', phone: walkInPhone || null },
          clientSaleId,
        },
        request,
        manager,
      );
      return { saleId: saleRef, replay: false, reservations: allReservations };
    });
  }

  async cancelPharmacySale(dto: CancelPharmacySaleDto, request: RequestContext) {
    const saleId = dto.saleId.trim();
    if (!saleId) throw domainBadRequest(ERROR_CODES.VALIDATION_ERROR, 'saleId is required.');
    return this.items.manager.transaction(async (manager) => {
      await this.assertReservationsReady(manager);
      const held = await this.heldReservations(manager, saleId);
      if (!held.length) {
        const any = await manager.getRepository(InventoryReservation).find({ where: { saleId } });
        if (any.some((row) => row.status === 'consumed')) {
          throw domainConflict(
            ERROR_CODES.SALE_ALREADY_ISSUED,
            'Medicine from this sale was already issued. Remaining stock cannot be cancelled as a pending hold.',
          );
        }
        throw domainNotFound(ERROR_CODES.NOT_FOUND, 'No pending pharmacy sale matches this id.');
      }
      await this.payments.cancelUnpaidPharmacyCharge(saleId, manager);
      const repo = manager.getRepository(InventoryReservation);
      for (const row of held) {
        row.status = 'released';
        row.updatedBy = request.user?.sub ?? null;
        await repo.save(row);
      }
      const orders = manager.getRepository(ClinicalOrder);
      const orderIds = [...new Set(held.map((row) => row.clinicalOrderId).filter(Boolean))] as string[];
      for (const id of orderIds) {
        const order = await orders.findOne({ where: { id } });
        if (!order || order.status === 'dispensed' || order.status === 'partially_dispensed') continue;
        order.status = 'cancelled';
        order.metadata = { ...(order.metadata ?? {}), saleStatus: 'cancelled', cancelReason: dto.reason ?? null };
        order.updatedBy = request.user?.sub ?? null;
        await orders.save(order);
      }
      return { saleId, released: held.length, reason: dto.reason ?? null };
    });
  }

  async pharmacySaleStatus(saleId: string, _request: RequestContext) {
    const held = await this.reservations.find({
      where: { saleId, status: 'held' },
      relations: { item: true, batch: true },
    });
    const charge = await this.payments.loadPharmacyCharge(saleId);
    const transactions = charge ? await this.payments.loadPaymentsForCharge(charge.id) : [];
    const clearance = evaluatePharmacyClearance({
      serviceEntityId: saleId,
      chargesEnabled: chargesEnabled(),
      charge,
      transactions,
    });
    return {
      saleId,
      reservedQuantity: held.reduce((sum, row) => sum + Number(row.quantity), 0),
      reservations: held.map((row) => ({
        id: row.id,
        itemId: row.item.id,
        batchId: row.batch.id,
        quantity: Number(row.quantity),
        status: row.status,
      })),
      chargeId: charge?.id ?? null,
      remaining: charge ? Number(charge.amountOwed) - Number(charge.amountPaid) - Number(charge.amountWaived) : null,
      clearance,
    };
  }

  private async preparePharmacyLine(
    line: { clinicalOrderId: string; itemId: string; quantity?: number; rejected?: boolean },
    request: RequestContext,
    manager: EntityManager,
  ) {
    const orders = manager.getRepository(ClinicalOrder);
    const items = manager.getRepository(InventoryItem);
    const locations = manager.getRepository(InventoryLocation);
    await orders.findOne({
      where: { id: line.clinicalOrderId, orderType: 'pharmacy' },
      lock: { mode: 'pessimistic_write' },
    });
    const order = await orders.findOne({
      where: { id: line.clinicalOrderId, orderType: 'pharmacy' },
      relations: { patient: true, encounter: true, admission: true },
    });
    if (!order) throw new NotFoundException('Pharmacy order not found');
    if (order.metadata?.kind === 'prescription') {
      throw domainBadRequest(ERROR_CODES.VALIDATION_ERROR, 'Prepare the medication lines, not the prescription header.');
    }
    if (order.status === 'cancelled') {
      throw domainConflict(ERROR_CODES.SALE_CANCELLED, 'This prescription was cancelled.');
    }
    const remaining = remainingQuantity(order);
    if (order.status === 'dispensed' || remaining === 0) {
      throw domainConflict(ERROR_CODES.SALE_ALREADY_ISSUED, 'This prescription line is already fully dispensed.');
    }
    const pharmacy = await locations.findOne({ where: { code: 'PHARMACY', active: true } });
    if (!pharmacy) throw new NotFoundException('Pharmacy location not configured');
    const item = await this.resolvePharmacyItem(items, order, line.itemId);
    const quantity = this.resolveDispenseQuantity(line.quantity, order, remaining);
    const saleId = prescriptionGroupId(order);
    const opId = dispenseOperationId({
      serviceEntityId: saleId,
      lines: [{ orderId: order.id, quantity }],
    });
    const existing = await this.heldReservations(manager, saleId, order.id);
    if (existing.length && existing.every((row) => row.prepareOpId === opId)) {
      return {
        saleId,
        orderId: order.id,
        orderNo: order.orderNo,
        quantity,
        replay: true,
        patientId: order.patient.id,
        encounterId: order.encounter?.id ?? null,
        admissionId: order.admission?.id ?? null,
        description: `${item.name} × ${quantity} ${item.unit}`,
        suggestedAmount: await this.suggestLineAmount(item, quantity, request),
      };
    }
    if (existing.length) {
      throw domainConflict(
        ERROR_CODES.CONFLICT,
        'This line already has a pending reservation. Cancel the sale before preparing a different quantity.',
      );
    }
    const batches = await this.lockLocationBatches(manager, item.id, pharmacy.id);
    const allocations = await this.allocateAvailableFromBatches(manager, batches, quantity, item.name);
    await this.insertReservations(
      manager,
      allocations.map((row) => ({
        saleId,
        clinicalOrderId: order.id,
        item,
        batch: row.batch,
        location: pharmacy,
        quantity: row.quantity,
        prepareOpId: opId,
      })),
      request,
    );
    order.metadata = { ...(order.metadata ?? {}), saleStatus: 'pending_payment', billingStatus: 'awaiting_payment' };
    order.updatedBy = request.user?.sub ?? null;
    await orders.save(order);
    return {
      saleId,
      orderId: order.id,
      orderNo: order.orderNo,
      quantity,
      replay: false,
      patientId: order.patient.id,
      encounterId: order.encounter?.id ?? null,
      admissionId: order.admission?.id ?? null,
      description: `${item.name} × ${quantity} ${item.unit}`,
      suggestedAmount: await this.suggestLineAmount(item, quantity, request),
    };
  }

  private async suggestLineAmount(
    item: InventoryItem,
    quantity: number,
    request: RequestContext,
  ) {
    const pricing = await this.readPricingMap(request);
    let unitSell = Number(pricing[item.sku]?.sell ?? 0);
    if (!(unitSell > 0)) {
      const settings = await this.loadSettings(request);
      const catalogue = readHospitalChargeCatalogue((settings?.clinicalCatalog as Record<string, unknown>) ?? null);
      unitSell =
        lookupCatalogueTariff(catalogue.items, {
          code: item.sku,
          name: item.name,
          category: 'pharmacy',
        }) ?? 0;
    }
    return Number.isFinite(unitSell) && unitSell > 0 ? Math.round(unitSell * quantity * 100) / 100 : null;
  }

  private async postPrepareCharge(
    billing: {
      saleId: string;
      patientId: string | null;
      encounterId: string | null;
      admissionId: string | null;
      description: string;
      suggestedAmount: number | null;
      orderNo?: string;
      lines: Array<{ orderId: string; quantity: number }>;
      walkIn?: { name: string; phone: string | null } | null;
      clientSaleId?: string;
    },
    request: RequestContext,
    manager: EntityManager,
  ) {
    if (!chargesEnabled()) {
      throw domainConflict(
        ERROR_CODES.CHARGES_DISABLED,
        'Operational charges are disabled. Medicine cannot be reserved until billing is available.',
      );
    }
    if (billing.suggestedAmount == null || billing.suggestedAmount <= 0) {
      throw domainConflict(
        ERROR_CODES.INCONSISTENT_CHARGE,
        'This product has no selling price. Price it in inventory before preparing the sale.',
      );
    }
    if (this.failNextImportWrite === 'charge') {
      this.failNextImportWrite = undefined;
      throw new BadRequestException('Forced charge failure');
    }
    const opId = dispenseOperationId({ serviceEntityId: billing.saleId, lines: billing.lines });
    const charge = await this.payments.upsertPharmacyCharge(
      {
        patientId: billing.patientId,
        encounterId: billing.encounterId,
        admissionId: billing.admissionId,
        serviceEntityId: billing.saleId,
        description: billing.description,
        amountDelta: billing.suggestedAmount,
        orderNo: billing.orderNo,
        userId: request.user?.sub ?? null,
        dispenseOpId: opId,
        opKind: 'prepare',
        walkIn: billing.walkIn ?? null,
        clientSaleId: billing.clientSaleId,
      },
      manager,
    );
    if (!charge) {
      throw domainConflict(
        ERROR_CODES.CHARGES_DISABLED,
        'Operational charges are disabled. Medicine cannot be reserved until billing is available.',
      );
    }
    return charge;
  }

  private async assertPharmacyClearance(saleId: string, manager: EntityManager) {
    const charge = await this.payments.loadPharmacyCharge(saleId, manager);
    const transactions = charge ? await this.payments.loadPaymentsForCharge(charge.id, manager) : [];
    const decision = evaluatePharmacyClearance({
      serviceEntityId: saleId,
      chargesEnabled: chargesEnabled(),
      charge,
      transactions,
    });
    if (!decision.cleared) {
      throw domainConflict(ERROR_CODES.FINANCIAL_CLEARANCE_DENIED, decision.message, {
        nextAction: 'Collect payment or a documented credit/exemption at the cashier desk, then issue.',
      });
    }
    return decision;
  }

  private async assertReservationsReady(manager: EntityManager) {
    try {
      await manager.query('SELECT 1 FROM demo.inventory_reservations LIMIT 1');
    } catch (error) {
      if (isUndefinedTable(error)) {
        throw domainConflict(
          ERROR_CODES.RESERVATIONS_UNAVAILABLE,
          'Pharmacy reservations are unavailable on this database. Apply the local inventory_reservations migration before preparing sales.',
        );
      }
      throw error;
    }
  }

  private async heldReservations(manager: EntityManager, saleId: string, clinicalOrderId?: string) {
    const repo = manager.getRepository(InventoryReservation);
    const where = {
      saleId,
      status: 'held' as const,
      ...(clinicalOrderId ? { clinicalOrderId } : {}),
    };
    await repo.find({
      where,
      lock: { mode: 'pessimistic_write' },
      order: { createdAt: 'ASC' },
    });
    return repo.find({
      where,
      relations: { item: true, batch: true, location: true },
      order: { createdAt: 'ASC' },
    });
  }

  private async reservedHeldQty(manager: EntityManager, batchId: string) {
    const rows = await manager.getRepository(InventoryReservation).find({
      where: { batch: { id: batchId }, status: 'held' },
    });
    return rows.reduce((sum, row) => sum + Number(row.quantity), 0);
  }

  private async allocateAvailableFromBatches(
    manager: EntityManager,
    batches: InventoryBatch[],
    quantity: number,
    itemName: string,
  ) {
    const usable = [...batches]
      .filter((batch) => !isExpiredBatch(batch.expiryDate) && Number(batch.qtyOnHand) > 0)
      .sort((a, b) => {
        const ax = a.expiryDate || '9999-12-31';
        const bx = b.expiryDate || '9999-12-31';
        if (ax !== bx) return ax.localeCompare(bx);
        return String(a.id ?? '').localeCompare(String(b.id ?? ''));
      });
    let remaining = quantity;
    const allocations: Array<{ batch: InventoryBatch; quantity: number }> = [];
    for (const batch of usable) {
      const held = await this.reservedHeldQty(manager, batch.id);
      const available = availableQuantity(Number(batch.qtyOnHand), held);
      if (available <= 0) continue;
      const take = Math.min(available, remaining);
      allocations.push({ batch, quantity: take });
      remaining -= take;
      if (remaining <= 0) break;
    }
    if (remaining > 0) {
      try {
        assertEnoughAvailable(quantity - remaining, quantity, itemName);
      } catch (error) {
        throw domainConflict(
          ERROR_CODES.INSUFFICIENT_STOCK,
          error instanceof Error ? error.message : 'Insufficient available stock.',
        );
      }
    }
    return allocations;
  }

  private async insertReservations(
    manager: EntityManager,
    rows: Array<{
      saleId: string;
      clinicalOrderId: string | null;
      item: InventoryItem;
      batch: InventoryBatch;
      location: InventoryLocation;
      quantity: number;
      prepareOpId: string;
    }>,
    request: RequestContext,
  ) {
    const repo = manager.getRepository(InventoryReservation);
    const saved: InventoryReservation[] = [];
    for (const row of rows) {
      saved.push(
        await repo.save(
          repo.create({
            saleId: row.saleId,
            clinicalOrderId: row.clinicalOrderId,
            item: row.item,
            batch: row.batch,
            location: row.location,
            quantity: row.quantity.toString(),
            status: 'held',
            prepareOpId: row.prepareOpId,
            createdBy: request.user?.sub ?? null,
            updatedBy: request.user?.sub ?? null,
          }),
        ),
      );
    }
    return saved;
  }

  private async consumeReservations(
    manager: EntityManager,
    held: InventoryReservation[],
    quantity: number,
    request: RequestContext,
  ) {
    let remaining = quantity;
    const allocations: Array<{ batch: InventoryBatch; quantity: number }> = [];
    const repo = manager.getRepository(InventoryReservation);
    for (const row of held) {
      if (remaining <= 0) break;
      const have = Number(row.quantity);
      const take = Math.min(have, remaining);
      if (isExpiredBatch(row.batch.expiryDate)) {
        throw domainConflict(
          ERROR_CODES.BATCH_INELIGIBLE,
          `Batch ${row.batch.batchNo ?? row.batch.id} is expired and cannot be issued.`,
        );
      }
      allocations.push({ batch: row.batch, quantity: take });
      if (take === have) {
        row.status = 'consumed';
      } else {
        row.quantity = (have - take).toString();
        await repo.save(
          repo.create({
            saleId: row.saleId,
            clinicalOrderId: row.clinicalOrderId,
            item: row.item,
            batch: row.batch,
            location: row.location,
            quantity: take.toString(),
            status: 'consumed',
            prepareOpId: row.prepareOpId,
            createdBy: request.user?.sub ?? null,
            updatedBy: request.user?.sub ?? null,
          }),
        );
      }
      row.updatedBy = request.user?.sub ?? null;
      await repo.save(row);
      remaining -= take;
    }
    if (remaining > 0) {
      throw domainConflict(
        ERROR_CODES.INSUFFICIENT_STOCK,
        `This sale only reserved ${quantity - remaining} units. Prepare the remaining quantity before issuing.`,
      );
    }
    return allocations;
  }

  private allocateFromBatches(
    batches: InventoryBatch[],
    quantity: number,
    insufficientMessage = 'Insufficient stock to fulfill this request.',
  ): Array<{ batch: InventoryBatch; quantity: number }> {
    let remaining = quantity;
    const allocations: Array<{ batch: InventoryBatch; quantity: number }> = [];
    const usable = [...batches]
      .filter((batch) => !isExpiredBatch(batch.expiryDate) && Number(batch.qtyOnHand) > 0)
      .sort((a, b) => {
        const ax = a.expiryDate || '9999-12-31';
        const bx = b.expiryDate || '9999-12-31';
        if (ax !== bx) return ax.localeCompare(bx);
        return String(a.id ?? '').localeCompare(String(b.id ?? ''));
      });
    for (const batch of usable) {
      const available = Number(batch.qtyOnHand);
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
    const previewOnly = Boolean(dto.previewOnly);
    const intent = resolveStockImportIntent(dto);
    const applyStock = Boolean(dto.confirmStockTake) && !previewOnly && intent !== 'catalogue';
    const updateExisting = Boolean(dto.updateExisting);
    const sessionId = dto.sessionId?.trim() || null;
    if (intent === 'stock_take' && applyStock) {
      throw domainBadRequest(
        ERROR_CODES.STOCK_TAKE_INVALID,
        'Stock-take counts cannot be posted from CSV. Import them into an open session; a different authorised user must approve before stock changes.',
        {
          nextAction:
            'Start or open a stock-take session, download the physical count sheet, import counts into that session, then submit for independent approval.',
        },
      );
    }
    if (applyStock && !sessionId) {
      throw new BadRequestException('A sessionId is required before posting a receipt import.');
    }
    const summary = {
      preview: previewOnly,
      intent,
      sessionId,
      stockTakeApplied: applyStock && intent === 'stock_take',
      receiptApplied: applyStock && intent === 'receipt',
      updateExisting,
      created: 0,
      updated: 0,
      skippedExisting: 0,
      received: 0,
      priced: 0,
      heldOpeningQty: 0,
      rejectedExpiredQty: 0,
      duplicates: [] as string[],
      errors: [] as string[],
      unresolved: [] as string[],
      rows: [] as Array<{
        line: number;
        sku: string;
        name: string;
        match: string;
        action: string;
        status: 'validated' | 'applied' | 'rejected' | 'failed';
        existingSku?: string;
        existingName?: string;
        systemQty: number | null;
        countedQty: number | null;
        varianceQty: number | null;
        varianceValue: number | null;
        staleSnapshot: boolean;
      }>,
      totals: {
        itemsCounted: 0,
        matched: 0,
        unresolved: 0,
        positiveAdjustments: 0,
        negativeAdjustments: 0,
        unchanged: 0,
        grossPositiveQty: 0,
        grossNegativeQty: 0,
        netQty: 0,
        grossPositiveValue: 0,
        grossNegativeValue: 0,
        netValue: 0,
      },
    };
    const defaultLocation = dto.locationId
      ? await this.locations.findOne({ where: { id: dto.locationId, active: true } })
      : null;
    if (dto.locationId && !defaultLocation) {
      throw new BadRequestException('Receive location was not found.');
    }
    if (!previewOnly && applyStock && !defaultLocation) {
      throw new BadRequestException('Choose a location before posting stock or a stock-take.');
    }

    type PendingMove = {
      intent: 'receipt' | 'stock_take';
      sku: string;
      locationId: string;
      quantity: number;
      snapshotQty: number | null;
      batchNo: string | null;
      expiryDate: string | null;
      line: number;
      matchId?: string;
      create?: {
        sku: string;
        name: string;
        category: InventoryCategory;
        drugClass: string;
        unit: string;
        trackBatch: boolean;
        strength?: string | null;
        dosageForm?: string | null;
        minLevel?: number;
        maxLevel?: number;
      };
      updateExisting?: {
        id: string;
        name: string;
        category: InventoryCategory;
        drugClass: string;
        unit: string;
        trackBatch?: boolean;
        strength?: string | null;
        dosageForm?: string | null;
        minLevel?: number;
        maxLevel?: number;
      };
      price?: ItemPrice;
    };
    const pendingMoves: PendingMove[] = [];
    const pendingCatalogue: PendingMove[] = [];
    const seenSku = new Set<string>();
    const seenIdentity = new Set<string>();
    const catalogue = await this.items.find({ select: { id: true, sku: true, name: true } });
    const refs = catalogue.map((item) => ({ id: item.id, sku: item.sku, name: item.name }));
    const bySku = new Map(refs.map((item) => [item.sku.toUpperCase(), item]));
    const byName = new Map(refs.map((item) => [normalizeProductName(item.name), item]));

    for (const [index, row] of rows.entries()) {
      const line = index + 2;
      const name = (row.name ?? '').trim();
      const unit = (row.unit ?? inferUnit(name)).trim() || 'unit';
      const sku = ((row.sku ?? '').trim() || skuFromName(name)).toUpperCase();
      if (!sku || !name) {
        summary.errors.push(`Line ${line}: item name is required.`);
        continue;
      }
      if (seenSku.has(sku)) {
        summary.duplicates.push(`Line ${line}: SKU ${sku} is repeated in this file.`);
        continue;
      }
      seenSku.add(sku);
      const category = normalizeInventoryCategory(row.category, name);
      const drugClass = (row.drug_class ?? row.class ?? classifyDrug(name, category)).trim() || classifyDrug(name, category);
      const identity = `${name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}|${unit.toLowerCase()}|${category}`;
      if (seenIdentity.has(identity)) {
        summary.duplicates.push(`Line ${line}: ${name} ${unit} looks like a duplicate product in this file.`);
      } else {
        seenIdentity.add(identity);
      }

      const countedRaw = row.counted_qty ?? row.physical_qty ?? row.opening_qty ?? row.quantity ?? '';
      const qty = countedRaw === '' ? NaN : Number(countedRaw);
      const snapshotQty = row.system_qty === '' || row.system_qty == null ? null : Number(row.system_qty);
      const expiry = row.expiry || row.expiry_date || '';
      if (Number.isFinite(qty) && qty > 0) {
        if (expiry && isExpiredBatch(expiry)) {
          summary.rejectedExpiredQty += 1;
          summary.errors.push(`Line ${line}: expired opening stock for ${sku} was not received.`);
        } else if (!applyStock) {
          summary.heldOpeningQty += 1;
        }
      }

      const existingBySku = bySku.get(sku) ?? null;
      const existingByName = byName.get(normalizeProductName(name)) ?? null;
      const likely =
        existingBySku || existingByName
          ? null
          : refs.find((item) => likelyNameMatch(item.name, name)) ?? null;
      const classified = classifyInventoryMatch({
        sku,
        name,
        existingBySku,
        existingByName: existingByName ?? likely,
      });
      if (classified.match === 'likely_name') {
        summary.unresolved.push(
          `Line ${line}: ${name} likely matches ${classified.existingSku} (${classified.existingName}). Not applied.`,
        );
      }

      const rawMinLevel = (row.min_level ?? row.reorder_level ?? '').trim();
      const rawMaxLevel = (row.max_level ?? '').trim();
      const minLevel = rawMinLevel === '' ? undefined : Number(rawMinLevel);
      const maxLevel = rawMaxLevel === '' ? undefined : Number(rawMaxLevel);
      const invalidQty = countedRaw.trim() !== '' && (!Number.isFinite(qty) || qty < 0);
      const invalidDate = Boolean(expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry.slice(0, 10)));
      const invalidMin = minLevel !== undefined && (!Number.isFinite(minLevel) || minLevel < 0);
      const invalidMax = maxLevel !== undefined && (!Number.isFinite(maxLevel) || maxLevel < 0);
      if (invalidQty) {
        summary.errors.push(`Line ${line}: quantity "${countedRaw}" must be a non-negative number.`);
      }
      if (invalidDate) {
        summary.errors.push(`Line ${line}: expiry date "${expiry}" must be YYYY-MM-DD.`);
      }
      if (invalidMin || invalidMax) {
        summary.errors.push(`Line ${line}: reorder/max level must be a non-negative number.`);
      }

      const action =
        classified.match === 'likely_name'
          ? 'hold_unresolved'
          : classified.match === 'new'
            ? 'create_product'
            : intent === 'catalogue'
              ? 'update_or_skip_product'
              : intent === 'receipt'
                ? 'receipt'
                : 'adjust';
      const rejected =
        classified.match === 'likely_name' ||
        invalidQty ||
        invalidDate ||
        invalidMin ||
        invalidMax ||
        (Number.isFinite(qty) && qty > 0 && expiry && isExpiredBatch(expiry));
      summary.rows.push({
        line,
        sku,
        name,
        match: classified.match,
        action,
        status: rejected ? 'rejected' : 'validated',
        existingSku: classified.existingSku,
        existingName: classified.existingName,
        systemQty: null,
        countedQty: Number.isFinite(qty) ? qty : null,
        varianceQty: null,
        varianceValue: null,
        staleSnapshot: false,
      });
      const previewRow = summary.rows[summary.rows.length - 1];

      const matchId =
        existingBySku?.id ??
        (classified.match === 'exact_name' || classified.match === 'exact_sku' ? existingByName?.id : undefined);
      if (matchId && defaultLocation && Number.isFinite(qty)) {
        const systemQty = await this.quantityOnHand(matchId, defaultLocation.id, row.batch_no?.trim() || null);
        previewRow.systemQty = systemQty;
        previewRow.varianceQty = stockVariance(qty, systemQty);
        const unitCost = (await this.readPricingMap(request))[sku]?.cost ?? 0;
        previewRow.varianceValue = varianceValue(previewRow.varianceQty, unitCost);
        if (snapshotQty != null && Number.isFinite(snapshotQty) && snapshotQty !== systemQty) {
          previewRow.staleSnapshot = true;
          previewRow.status = 'rejected';
          summary.errors.push(
            `Line ${line}: system quantity changed (${snapshotQty} → ${systemQty}) since the sheet was downloaded. Recount before posting.`,
          );
        }
      }

      const cost = Number(row.cost ?? row.cost_price ?? '');
      const sell = Number(row.sell ?? row.selling_price ?? row.rate ?? '');
      const markup = Number(row.markup ?? row.markup_percent ?? '');
      let price: ItemPrice | undefined;
      if ([cost, sell, markup].some((value) => Number.isFinite(value) && value !== 0) || row.sell === '0') {
        if ([cost, sell, markup].some((value) => Number.isFinite(value) && value < 0)) {
          previewRow.status = 'rejected';
          summary.errors.push(`Line ${line}: prices cannot be negative.`);
        } else {
          price = resolvePrice({
            cost: Number.isFinite(cost) ? cost : 0,
            markup: Number.isFinite(markup) ? markup : 0,
            sell: Number.isFinite(sell) ? sell : 0,
            preferSell: Number.isFinite(sell) && sell > 0,
          });
        }
      }

      if (previewOnly) {
        if (classified.match === 'new') summary.created += 1;
        else if (classified.match === 'likely_name') summary.skippedExisting += 1;
        else summary.updated += 1;
        continue;
      }

      if (classified.match === 'likely_name' || rejected) {
        summary.skippedExisting += 1;
        continue;
      }

      const location =
        defaultLocation ??
        (await this.locations.findOne({
          where: {
            code: category === 'pharmaceutical' ? 'PHARMACY' : 'MAIN_STORE',
            active: true,
          },
        }));
      const strength = (row.strength ?? '').trim() || null;
      const dosageForm = (row.dosage_form ?? row.form ?? '').trim() || null;
      const work: PendingMove = {
        intent: intent === 'stock_take' ? 'stock_take' : 'receipt',
        sku,
        locationId: location?.id ?? '',
        quantity: qty,
        snapshotQty: Number.isFinite(snapshotQty as number) ? snapshotQty : previewRow.systemQty,
        batchNo: row.batch_no?.trim() || null,
        expiryDate: expiry ? expiry.slice(0, 10) : null,
        line,
        matchId,
        price,
      };
      if (!matchId) {
        work.create = {
          sku,
          name,
          category,
          drugClass,
          unit,
          trackBatch: parseBool(row.track_batch) ?? category === 'pharmaceutical',
          strength,
          dosageForm,
          minLevel,
          maxLevel,
        };
      } else if (updateExisting) {
        work.updateExisting = {
          id: matchId,
          name,
          category,
          drugClass,
          unit: (row.unit ?? unit).trim() || unit,
          trackBatch: row.track_batch != null && row.track_batch !== '' ? parseBool(row.track_batch) : undefined,
          strength: strength ?? undefined,
          dosageForm: dosageForm ?? undefined,
          minLevel,
          maxLevel,
        };
      }
      pendingCatalogue.push(work);
      if (
        applyStock &&
        Number.isFinite(qty) &&
        qty >= 0 &&
        !(expiry && isExpiredBatch(expiry)) &&
        location &&
        !previewRow.staleSnapshot
      ) {
        if (intent === 'stock_take' && (parseBool(row.track_batch) ?? category === 'pharmaceutical') && !work.batchNo) {
          previewRow.status = 'rejected';
          summary.errors.push(
            `Line ${line}: stock-take for a batch-tracked item must include batch_no so variance is per lot.`,
          );
        } else {
          pendingMoves.push(work);
        }
      } else if (applyStock && Number.isFinite(qty) && qty >= 0 && !location) {
        previewRow.status = 'rejected';
        summary.errors.push(`Line ${line}: no location for quantity.`);
      }
    }

    summary.totals = summarizeVariances(
      summary.rows.map((row) => ({
        varianceQty: row.varianceQty ?? 0,
        varianceValue: row.varianceValue ?? 0,
        unresolved: row.match === 'likely_name',
      })),
    );

    if (previewOnly) {
      return summary;
    }

    if (applyStock && intent === 'stock_take' && summary.errors.length) {
      throw new BadRequestException(
        `Stock-take was not posted: ${summary.errors.length} row(s) need review. ${summary.errors[0]}`,
      );
    }

    const canStoreStrength = await this.hasStrengthColumns();
    const canStoreReorder = await this.hasReorderColumns();
    await this.items.manager.transaction(async (manager) => {
      const itemIds = new Map<string, string>();
      for (const work of pendingCatalogue) {
        const items = manager.getRepository(InventoryItem);
        let item: InventoryItem | null = work.matchId
          ? await items.findOne({ where: { id: work.matchId } })
          : null;
        if (!item && work.create) {
          if (this.failNextImportWrite === 'catalogue') {
            this.failNextImportWrite = undefined;
            throw new BadRequestException('Forced catalogue write failure');
          }
          item = await items.save(
            items.create({
              sku: work.create.sku,
              name: work.create.name,
              category: work.create.category,
              drugClass: work.create.drugClass,
              unit: work.create.unit,
              trackBatch: work.create.trackBatch,
              ...(canStoreStrength
                ? {
                    strength: work.create.strength ?? null,
                    dosageForm: work.create.dosageForm ?? null,
                  }
                : {}),
              ...(canStoreReorder
                ? {
                    minLevel: work.create.minLevel != null ? String(work.create.minLevel) : null,
                    maxLevel: work.create.maxLevel != null ? String(work.create.maxLevel) : null,
                  }
                : {}),
              active: true,
              createdBy: request.user?.sub ?? null,
              updatedBy: request.user?.sub ?? null,
            }),
          );
          summary.created += 1;
        } else if (item && work.updateExisting) {
          item.name = work.updateExisting.name;
          item.category = work.updateExisting.category;
          item.drugClass = work.updateExisting.drugClass;
          item.unit = work.updateExisting.unit;
          if (work.updateExisting.trackBatch != null) item.trackBatch = work.updateExisting.trackBatch;
          if (canStoreStrength) {
            if (work.updateExisting.strength !== undefined) item.strength = work.updateExisting.strength ?? null;
            if (work.updateExisting.dosageForm !== undefined) item.dosageForm = work.updateExisting.dosageForm ?? null;
          }
          if (canStoreReorder) {
            if (work.updateExisting.minLevel !== undefined) item.minLevel = String(work.updateExisting.minLevel);
            if (work.updateExisting.maxLevel !== undefined) item.maxLevel = String(work.updateExisting.maxLevel);
          }
          item.updatedBy = request.user?.sub ?? null;
          item = await items.save(item);
          summary.updated += 1;
        } else if (item) {
          summary.skippedExisting += 1;
        }
        if (!item) continue;
        itemIds.set(work.sku, item.id);
        if (work.price) {
          await this.writePricing(item.sku, work.price, request, manager);
          summary.priced += 1;
        }
      }

      if (applyStock) {
        const prepared = pendingMoves.map((move) => ({
          ...move,
          itemId: itemIds.get(move.sku) ?? move.matchId,
        }));
        if (sessionId) {
          const claimIntent = intent === 'stock_take' ? 'stock_take' : 'receipt';
          await this.claimImportSession(manager, sessionId, claimIntent);
          const claimItemId =
            prepared.find((move) => move.itemId)?.itemId ?? [...itemIds.values()][0] ?? null;
          if (claimItemId) {
            await this.writeImportSessionClaim(manager, claimItemId, sessionId, claimIntent, request);
          }
        }
        const lockKeys = sortStockLockKeys(
          prepared
            .filter((move) => move.itemId && move.locationId)
            .map((move) => ({
              itemId: move.itemId as string,
              locationId: move.locationId,
              batchNo: move.batchNo,
            })),
        );
        const itemLockIds = [...new Set(lockKeys.map((key) => key.itemId))].sort();
        for (const itemId of itemLockIds) {
          await this.lockItem(manager, itemId);
        }
        for (const key of lockKeys) {
          await this.lockMatchingBatch(manager, key.itemId, key.locationId, key.batchNo);
        }
        for (const move of prepared) {
          const previewRow = summary.rows.find((row) => row.line === move.line);
          try {
            if (!move.itemId || !move.locationId) {
              throw new BadRequestException(`Line ${move.line}: item or location is missing.`);
            }
            const item = await manager.getRepository(InventoryItem).findOneByOrFail({ id: move.itemId });
            const location = await manager.getRepository(InventoryLocation).findOneByOrFail({ id: move.locationId });
            if (move.intent === 'stock_take') {
              if (this.failNextImportWrite === 'adjust') {
                this.failNextImportWrite = undefined;
                throw new BadRequestException('Forced stock adjustment failure');
              }
              const systemQty = await this.quantityOnHand(move.itemId, move.locationId, move.batchNo, manager);
              try {
                assertFreshSnapshot(move.snapshotQty, systemQty, move.line);
              } catch (error) {
                throw new BadRequestException(error instanceof Error ? error.message : 'Stale snapshot');
              }
              const variance = stockVariance(move.quantity, systemQty);
              if (variance !== 0) {
                await this.adjustOnHand({
                  manager,
                  item,
                  location,
                  variance,
                  batchNo: move.batchNo,
                  expiryDate: move.expiryDate,
                  sessionId,
                  reason: `Stock-take ${move.sku}: counted ${move.quantity}, system ${systemQty}, variance ${variance}`,
                  request,
                });
                summary.received += 1;
              }
            } else {
              await this.receiveStockIn(
                manager,
                {
                  itemId: move.itemId,
                  locationId: move.locationId,
                  quantity: move.quantity,
                  batchNo: move.batchNo || undefined,
                  expiryDate: move.expiryDate || undefined,
                  reason: `Confirmed receipt import ${move.sku}`,
                },
                request,
                sessionId,
              );
              summary.received += 1;
            }
            if (previewRow) previewRow.status = 'applied';
          } catch (error) {
            if (previewRow) previewRow.status = 'failed';
            throw error;
          }
        }
      } else {
        for (const row of summary.rows) {
          if (row.status === 'validated') row.status = 'applied';
        }
      }
    });

    return summary;
  }

  private async quantityOnHand(
    itemId: string,
    locationId: string,
    batchNo: string | null,
    manager?: EntityManager,
  ) {
    const batches = manager ? manager.getRepository(InventoryBatch) : this.batches;
    const where = batchNo
      ? { item: { id: itemId }, location: { id: locationId }, batchNo }
      : { item: { id: itemId }, location: { id: locationId } };
    const rows = await batches.find({ where });
    return roundQty(rows.reduce((sum, row) => sum + Number(row.qtyOnHand), 0));
  }

  private async lockItem(manager: EntityManager, itemId: string) {
    await manager.getRepository(InventoryItem).findOne({
      where: { id: itemId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  private async lockLocationBatches(manager: EntityManager, itemId: string, locationId: string) {
    await this.lockItem(manager, itemId);
    const batches = manager.getRepository(InventoryBatch);
    const candidates = await batches.find({
      where: { item: { id: itemId }, location: { id: locationId } },
      order: { id: 'ASC' },
    });
    const locked: InventoryBatch[] = [];
    for (const id of [...new Set(candidates.map((row) => row.id))].sort()) {
      const row = await batches.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      const hydrated = row
        ? await batches.findOne({
            where: { id },
            relations: { item: true, location: true },
          })
        : null;
      if (hydrated) locked.push(hydrated);
    }
    return locked;
  }

  private async lockMatchingBatch(
    manager: EntityManager,
    itemId: string,
    locationId: string,
    batchNo: string | null,
  ) {
    const batches = manager.getRepository(InventoryBatch);
    const where = batchNo
      ? { item: { id: itemId }, location: { id: locationId }, batchNo }
      : { item: { id: itemId }, location: { id: locationId }, batchNo: IsNull() };
    const matches = await batches.find({ where, order: { id: 'ASC' } });
    let locked: InventoryBatch | null = null;
    for (const id of matches.map((row) => row.id).sort()) {
      const row = await batches.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      const hydrated = row
        ? await batches.findOne({
            where: { id },
            relations: { item: true, location: true },
          })
        : null;
      if (hydrated && !locked) locked = hydrated;
    }
    return locked;
  }

  private async claimImportSession(
    manager: EntityManager,
    sessionKey: string,
    intent: 'receipt' | 'stock_take',
  ) {
    await this.acquireImportAdvisoryLock(manager, `${intent}:${sessionKey}`);
    const referenceType = importLedgerReferenceType(intent);
    const referenceId = importSessionReferenceId(sessionKey);
    const inserted = await this.tryInsertImportSessionRow(manager, sessionKey, referenceId, intent);
    if (inserted === 'duplicate') {
      throw new BadRequestException(duplicateImportSessionMessage());
    }
    const existing = await manager.getRepository(InventoryTransaction).findOne({
      where: { referenceType, referenceId },
    });
    if (existing) {
      throw new BadRequestException(duplicateImportSessionMessage());
    }
    return referenceId;
  }

  private async writeImportSessionClaim(
    manager: EntityManager,
    itemId: string,
    sessionKey: string,
    intent: 'receipt' | 'stock_take',
    request: RequestContext,
  ) {
    const item = await manager.getRepository(InventoryItem).findOneByOrFail({ id: itemId });
    const ledger = manager.getRepository(InventoryTransaction);
    await ledger.save(
      ledger.create({
        item,
        batch: null,
        sourceLocation: null,
        destinationLocation: null,
        quantity: '0',
        unit: item.unit,
        transactionType: intent === 'stock_take' ? 'STOCK_TAKE' : 'RECEIPT',
        referenceType: importLedgerReferenceType(intent),
        referenceId: importSessionReferenceId(sessionKey),
        reason: 'Import session posted',
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  private async acquireImportAdvisoryLock(manager: EntityManager, key: string) {
    try {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [
        ADVISORY_LOCK_NAMESPACE,
        key,
      ]);
    } catch (error) {
      if (isUndefinedFunction(error)) return;
      throw error;
    }
  }

  private async tryInsertImportSessionRow(
    manager: EntityManager,
    sessionKey: string,
    referenceId: string,
    intent: 'receipt' | 'stock_take',
  ): Promise<'inserted' | 'missing' | 'duplicate'> {
    try {
      await manager.query(
        `INSERT INTO demo.inventory_import_sessions (id, session_key, intent, status, posted_at)
         VALUES ($1, $2, $3, 'posted', now())`,
        [referenceId, sessionKey, intent],
      );
      return 'inserted';
    } catch (error) {
      if (isUndefinedTable(error)) return 'missing';
      if (isUniqueViolation(error)) return 'duplicate';
      const message = error instanceof Error ? error.message : String(error);
      if (/inventory_import_sessions|does not exist|no such table/i.test(message)) return 'missing';
      throw error;
    }
  }

  private async adjustOnHand(input: {
    manager: EntityManager;
    item: InventoryItem;
    location: InventoryLocation;
    variance: number;
    batchNo: string | null;
    expiryDate: string | null;
    sessionId: string | null;
    reason: string;
    request: RequestContext;
  }) {
    const batches = input.manager.getRepository(InventoryBatch);
    const ledger = input.manager.getRepository(InventoryTransaction);
    await this.lockItem(input.manager, input.item.id);
    let batch = await this.lockMatchingBatch(
      input.manager,
      input.item.id,
      input.location.id,
      input.batchNo,
    );
    if (!batch) {
      batch = await batches.save(
        batches.create({
          item: input.item,
          location: input.location,
          batchNo: input.batchNo,
          expiryDate: input.expiryDate,
          qtyOnHand: '0',
          createdBy: input.request.user?.sub ?? null,
          updatedBy: input.request.user?.sub ?? null,
        }),
      );
    }
    try {
      batch.qtyOnHand = nextOnHand(Number(batch.qtyOnHand), input.variance).toString();
    } catch {
      throw new BadRequestException(
        `Stock-take for ${input.item.sku} would make quantity negative. Recount or receive missing stock first.`,
      );
    }
    batch.updatedBy = input.request.user?.sub ?? null;
    await batches.save(batch);
    if (this.failNextImportWrite === 'ledger') {
      this.failNextImportWrite = undefined;
      throw new BadRequestException('Forced ledger write failure');
    }
    await ledger.save(
      ledger.create({
        item: input.item,
        batch,
        sourceLocation: input.variance < 0 ? input.location : null,
        destinationLocation: input.variance > 0 ? input.location : null,
        quantity: input.variance.toString(),
        unit: input.item.unit,
        transactionType: 'STOCK_TAKE',
        referenceType: STOCK_TAKE_REFERENCE_TYPE,
        referenceId: input.sessionId ? importSessionReferenceId(input.sessionId) : null,
        reason: input.reason,
        createdBy: input.request.user?.sub ?? null,
        updatedBy: input.request.user?.sub ?? null,
      }),
    );
  }

  async exportStockSheetCsv(locationId: string | undefined, request: RequestContext) {
    const location = locationId
      ? await this.locations.findOne({ where: { id: locationId, active: true } })
      : await this.locations.findOne({ where: { code: 'PHARMACY', active: true } });
    if (!location) throw new NotFoundException('Location not found');
    const items = await this.listItems({ request });
    const batches = await this.batches.find({
      where: { location: { id: location.id } },
      relations: { item: true, location: true },
    });
    const byItem = new Map<string, InventoryBatch[]>();
    for (const batch of batches) {
      const list = byItem.get(batch.item.id) ?? [];
      list.push(batch);
      byItem.set(batch.item.id, list);
    }
    const header = [
      'item_id',
      'sku',
      'name',
      'unit',
      'category',
      'location_id',
      'location_code',
      'batch_id',
      'batch_no',
      'expiry',
      'system_qty',
      'cost',
      'sell',
      'counted_qty',
      'variance',
    ];
    const lines = [header.join(',')];
    for (const item of items) {
      const itemBatches = byItem.get(item.id) ?? [];
      if (!itemBatches.length) {
        lines.push(
          [
            csvEscape(item.id),
            csvEscape(item.sku),
            csvEscape(item.name),
            csvEscape(item.unit),
            csvEscape(item.category),
            csvEscape(location.id),
            csvEscape(location.code),
            '',
            '',
            '',
            '0',
            csvEscape(item.cost ?? 0),
            csvEscape(item.sell ?? 0),
            '',
            '',
          ].join(','),
        );
        continue;
      }
      for (const batch of itemBatches) {
        lines.push(
          [
            csvEscape(item.id),
            csvEscape(item.sku),
            csvEscape(item.name),
            csvEscape(item.unit),
            csvEscape(item.category),
            csvEscape(location.id),
            csvEscape(location.code),
            csvEscape(batch.id),
            csvEscape(batch.batchNo),
            csvEscape(batch.expiryDate),
            csvEscape(batch.qtyOnHand),
            csvEscape(item.cost ?? 0),
            csvEscape(item.sell ?? 0),
            '',
            '',
          ].join(','),
        );
      }
    }
    return { filename: `stock-sheet-${location.code}-${new Date().toISOString().slice(0, 10)}.csv`, csv: lines.join('\n') };
  }

  async previewBulkPricing(dto: BulkPricingDto, request: RequestContext) {
    const items = await this.listItems({ category: dto.category, request });
    const selected = dto.itemIds?.length ? items.filter((item) => dto.itemIds!.includes(item.id)) : items;
    const ready: Array<Record<string, unknown>> = [];
    const missingCost: Array<Record<string, unknown>> = [];
    for (const item of selected) {
      const cost = Number(item.cost ?? 0);
      const currentSell = Number(item.sell ?? 0);
      const proposed = proposedSellPrice({
        cost,
        currentSell,
        mode: dto.mode,
        value: dto.value,
      });
      const row = {
        id: item.id,
        sku: item.sku,
        name: item.name,
        ...proposed,
      };
      if (!(cost > 0) && dto.mode === 'percent_markup') missingCost.push(row);
      else ready.push(row);
    }
    return { preview: true, ready, missingCost, count: ready.length };
  }

  async applyBulkPricing(dto: BulkPricingDto, request: RequestContext) {
    if (!dto.confirm) {
      throw new BadRequestException('Confirm the price preview before applying. Historical invoices are not changed.');
    }
    const preview = await this.previewBulkPricing(dto, request);
    const reason = dto.reason?.trim() || 'Bulk selling-price update';
    for (const row of preview.ready) {
      const sku = String(row.sku);
      await this.writePricing(
        sku,
        {
          cost: Number(row.cost),
          markup: Number(row.markup),
          sell: Number(row.proposedSell),
        },
        request,
      );
    }
    const settings = await this.loadSettings(request);
    if (settings) {
      const catalog = { ...(settings.clinicalCatalog ?? {}) } as Record<string, unknown>;
      const history = Array.isArray(catalog.inventoryPriceHistory)
        ? (catalog.inventoryPriceHistory as unknown[])
        : [];
      history.push({
        at: new Date().toISOString(),
        by: request.user?.sub ?? null,
        reason,
        mode: dto.mode,
        value: dto.value,
        count: preview.ready.length,
      });
      catalog.inventoryPriceHistory = history.slice(-50);
      await this.settings.update(settings.id, {
        clinicalCatalog: catalog as never,
        updatedBy: request.user?.sub ?? null,
      });
    }
    return { applied: preview.ready.length, skippedMissingCost: preview.missingCost.length, reason };
  }

  async integrityReport(request: RequestContext) {
    const batches = await this.batches.find({ relations: { item: true, location: true } });
    const ledger = await this.transactions.find({ relations: { batch: true, item: true } });
    const ledgerByBatch = new Map<string, Array<{ quantity: string }>>();
    for (const row of ledger) {
      if (!row.batch?.id) continue;
      const list = ledgerByBatch.get(row.batch.id) ?? [];
      list.push(row);
      ledgerByBatch.set(row.batch.id, list);
    }
    const negative = batches.filter((batch) => Number(batch.qtyOnHand) < 0);
    const missingBatch = batches.filter(
      (batch) => batch.item.trackBatch && (!batch.batchNo || !batch.expiryDate) && Number(batch.qtyOnHand) !== 0,
    );
    const withoutReference = ledger.filter((row) => !row.referenceType || !row.referenceId);
    const balanceMismatch = batches
      .map((batch) => {
        const expected = ledgerNetQuantity(ledgerByBatch.get(batch.id) ?? []);
        const stored = Number(batch.qtyOnHand);
        return {
          batchId: batch.id,
          sku: batch.item.sku,
          name: batch.item.name,
          stored,
          ledger: expected,
          difference: roundQty(stored - expected),
        };
      })
      .filter((row) => row.difference !== 0);
    const skuCounts = new Map<string, number>();
    const items = await this.items.find();
    for (const item of items) skuCounts.set(item.sku.toUpperCase(), (skuCounts.get(item.sku.toUpperCase()) ?? 0) + 1);
    const duplicateSkus = [...skuCounts.entries()].filter(([, count]) => count > 1).map(([sku]) => sku);
    const repeats = new Map<string, number>();
    for (const row of ledger.filter((entry) => entry.transactionType === 'STOCK_TAKE' || entry.transactionType === 'ADJUSTMENT')) {
      repeats.set(row.item.id, (repeats.get(row.item.id) ?? 0) + 1);
    }
    const repeatedAdjustments = [...repeats.entries()]
      .filter(([, count]) => count >= 3)
      .map(([itemId, count]) => {
        const item = items.find((row) => row.id === itemId);
        return { itemId, sku: item?.sku, name: item?.name, adjustmentCount: count };
      });
    const gaps = await this.listDispensesAwaitingBilling();
    return {
      generatedAt: new Date().toISOString(),
      valuation: 'Unit cost from hospital price overlay. Selling price is not used for stock value.',
      negativeStock: negative.map((batch) => ({
        sku: batch.item.sku,
        name: batch.item.name,
        qty: Number(batch.qtyOnHand),
        location: batch.location.code,
      })),
      missingBatchOrExpiry: missingBatch.map((batch) => ({
        sku: batch.item.sku,
        name: batch.item.name,
        batchNo: batch.batchNo,
        expiryDate: batch.expiryDate,
      })),
      movementsWithoutReference: withoutReference.length,
      balanceMismatch,
      duplicateSkus,
      repeatedAdjustments,
      didNotAutoRepair: true,
      dispensesAwaitingBilling: gaps.awaiting,
      legacyDispensesForReview: gaps.legacy,
    };
  }

  private async listDispensesAwaitingBilling() {
    const orders = await this.clinicalOrders.find({
      where: { orderType: 'pharmacy', status: In(['dispensed', 'partially_dispensed']) },
      take: 200,
      order: { completedAt: 'DESC' },
    });
    const awaiting: Array<{ orderId: string; orderNo: string; billingStatus: string }> = [];
    const legacy: Array<{ orderId: string; orderNo: string; billingStatus: string }> = [];
    for (const order of orders) {
      if (order.metadata?.kind === 'prescription') continue;
      const status = String(order.metadata?.billingStatus ?? '');
      if (status === 'awaiting_charge') {
        awaiting.push({ orderId: order.id, orderNo: order.orderNo, billingStatus: status });
      } else if (!status) {
        legacy.push({
          orderId: order.id,
          orderNo: order.orderNo,
          billingStatus: 'legacy_unreviewed',
        });
      }
    }
    return { awaiting, legacy };
  }

  async listStockTakeHistory() {
    const rows = await this.transactions.find({
      where: { transactionType: 'STOCK_TAKE' },
      relations: { item: true, batch: true },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = row.referenceId ?? row.id;
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }
    return [...groups.entries()].map(([sessionId, lines]) => ({
      sessionId,
      postedAt: lines[0]?.createdAt,
      lines: lines.length,
      netQty: ledgerNetQuantity(lines),
    }));
  }

  async oversightSummary() {
    const locations = await this.locations.find({ where: { active: true } });
    const batches = await this.batches.find({ relations: { item: true, location: true } });
    const held = await this.reservations.find({
      where: { status: 'held' },
      relations: { batch: true, location: true },
    });
    const heldByBatch = new Map<string, number>();
    for (const row of held) {
      heldByBatch.set(row.batch.id, (heldByBatch.get(row.batch.id) ?? 0) + Number(row.quantity));
    }
    const today = new Date().toISOString().slice(0, 10);
    const expiryHorizon = new Date();
    expiryHorizon.setDate(expiryHorizon.getDate() + 90);
    const horizon = expiryHorizon.toISOString().slice(0, 10);
    let onHand = 0;
    let reserved = 0;
    let available = 0;
    let expiredLots = 0;
    let nearExpiryLots = 0;
    for (const batch of batches) {
      const qty = Number(batch.qtyOnHand);
      if (qty <= 0) continue;
      const hold = heldByBatch.get(batch.id) ?? 0;
      onHand += qty;
      reserved += hold;
      available += Math.max(0, qty - hold);
      if (batch.expiryDate && batch.expiryDate < today) expiredLots += 1;
      else if (batch.expiryDate && batch.expiryDate <= horizon) nearExpiryLots += 1;
    }
    let pendingSessions = 0;
    try {
      pendingSessions = await this.stockTakeSessions.count({
        where: [{ status: 'open' }, { status: 'submitted' }, { status: 'rejected' }],
      });
    } catch {
      pendingSessions = 0;
    }
    return {
      locations: locations.length,
      onHand: roundQty(onHand),
      reserved: roundQty(reserved),
      available: roundQty(available),
      expiredLots,
      nearExpiryLots,
      pendingStockTakes: pendingSessions,
    };
  }

  async pharmacyDashboard(request?: RequestContext) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayIso = new Date().toISOString().slice(0, 10);
    const horizonDate = new Date();
    horizonDate.setDate(horizonDate.getDate() + 90);
    const horizonIso = horizonDate.toISOString().slice(0, 10);

    const [orders, locations, items, heldReservations, recentCharges, recentPayments, recentMovements] =
      await Promise.all([
        this.clinicalOrders.find({
          where: { orderType: 'pharmacy' },
          relations: { patient: true, encounter: true, admission: { ward: true, bed: true } },
          order: { orderedAt: 'DESC' },
          take: 150,
        }),
        this.locations.find({ where: { active: true }, order: { name: 'ASC' } }),
        this.listItems({ category: 'pharmaceutical', includeInactive: true, request }),
        this.reservations.find({
          where: { status: 'held' },
          relations: { item: true, batch: true, location: true },
        }),
        this.payments.listRecentPharmacyCharges(150),
        this.payments.listRecentPharmacyPayments(150),
        this.listTransactions({ limit: 30 }),
      ]);

    const pharmacyLocation =
      locations.find((loc) => loc.code === 'PHARMACY' || loc.locationType === 'pharmacy') ?? null;

    const batches = pharmacyLocation
      ? await this.batches.find({
          where: { location: { id: pharmacyLocation.id } },
          relations: { item: true, location: true },
          order: { expiryDate: 'ASC' },
        })
      : [];

    const heldByBatch = new Map<string, number>();
    for (const row of heldReservations) {
      if (pharmacyLocation && row.location?.id !== pharmacyLocation.id) continue;
      heldByBatch.set(row.batch.id, (heldByBatch.get(row.batch.id) ?? 0) + Number(row.quantity));
    }

    let onHandTotal = 0;
    let reservedTotal = 0;
    let availableTotal = 0;
    const expiredBatches: Array<{
      batchId: string;
      sku: string;
      name: string;
      batchNo: string | null;
      expiryDate: string;
      qtyOnHand: number;
    }> = [];
    const nearExpiryBatches: Array<{
      batchId: string;
      sku: string;
      name: string;
      batchNo: string | null;
      expiryDate: string;
      qtyOnHand: number;
      availableQty: number;
    }> = [];

    const usableByItem = new Map<string, { onHand: number; reserved: number; available: number }>();

    for (const batch of batches) {
      const qty = roundQty(Number(batch.qtyOnHand));
      if (qty <= 0) continue;
      const held = roundQty(heldByBatch.get(batch.id) ?? 0);
      const isExpired = Boolean(batch.expiryDate && batch.expiryDate < todayIso);
      const avail = isExpired ? 0 : Math.max(0, roundQty(qty - held));
      onHandTotal += qty;
      reservedTotal += held;
      availableTotal += avail;

      if (isExpired && batch.expiryDate) {
        expiredBatches.push({
          batchId: batch.id,
          sku: batch.item.sku,
          name: batch.item.name,
          batchNo: batch.batchNo,
          expiryDate: batch.expiryDate,
          qtyOnHand: qty,
        });
      } else if (batch.expiryDate && batch.expiryDate <= horizonIso) {
        nearExpiryBatches.push({
          batchId: batch.id,
          sku: batch.item.sku,
          name: batch.item.name,
          batchNo: batch.batchNo,
          expiryDate: batch.expiryDate,
          qtyOnHand: qty,
          availableQty: avail,
        });
      }

      if (!isExpired) {
        const cur = usableByItem.get(batch.item.id) ?? { onHand: 0, reserved: 0, available: 0 };
        cur.onHand = roundQty(cur.onHand + qty);
        cur.reserved = roundQty(cur.reserved + held);
        cur.available = roundQty(cur.available + avail);
        usableByItem.set(batch.item.id, cur);
      }
    }

    const lowStockItems: Array<{
      itemId: string;
      sku: string;
      name: string;
      unit: string;
      onHand: number;
      available: number;
      minLevel: number;
    }> = [];
    const outOfStockItems: Array<{
      itemId: string;
      sku: string;
      name: string;
      unit: string;
      minLevel: number | null;
    }> = [];

    for (const item of items) {
      if (!item.active) continue;
      const bal = usableByItem.get(item.id) ?? { onHand: 0, reserved: 0, available: 0 };
      const min = item.minLevel != null && Number.isFinite(Number(item.minLevel)) ? Number(item.minLevel) : 10;
      if (bal.available <= 0) {
        outOfStockItems.push({
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          unit: item.unit,
          minLevel: item.minLevel ?? null,
        });
      } else if (bal.available <= min) {
        lowStockItems.push({
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          unit: item.unit,
          onHand: bal.onHand,
          available: bal.available,
          minLevel: min,
        });
      }
    }

    const activeOrders = orders.filter(
      (order) =>
        order.metadata?.kind !== 'prescription' &&
        order.status !== 'cancelled' &&
        order.status !== 'dispensed' &&
        remainingQuantity(order) !== 0,
    );
    const isIpdOrder = (order: ClinicalOrder) =>
      Boolean(order.admission?.id || order.encounter?.type === 'inpatient');
    const opdOrders = activeOrders.filter((order) => !isIpdOrder(order));
    const ipdOrders = activeOrders.filter((order) => isIpdOrder(order));

    const otcChargesToday = recentCharges.filter((charge) => {
      const created = new Date(charge.createdAt).getTime() >= startOfToday.getTime();
      const orderNo = String(charge.metadata?.orderNo ?? '');
      const isOtc = orderNo.startsWith('OTC-') || Boolean(charge.metadata?.walkIn || charge.metadata?.clientSaleId);
      return created && isOtc && charge.status !== 'cancelled';
    });
    const otcPaymentsToday = recentPayments.filter((txn) => {
      const created = new Date(txn.createdAt).getTime() >= startOfToday.getTime();
      return created && txn.status === 'completed' && txn.metadata?.kind !== 'refund';
    });

    let pendingSessions = 0;
    let submittedSessions = 0;
    try {
      const openRows = await this.stockTakeSessions.find({
        where: [{ status: 'open' }, { status: 'submitted' }, { status: 'rejected' }],
      });
      pendingSessions = openRows.length;
      submittedSessions = openRows.filter((row) => row.status === 'submitted').length;
    } catch {
      pendingSessions = 0;
      submittedSessions = 0;
    }

    const openOtcQueue = recentCharges
      .filter((charge) => {
        const orderNo = String(charge.metadata?.orderNo ?? '');
        const isOtc = orderNo.startsWith('OTC-') || Boolean(charge.metadata?.walkIn || charge.metadata?.clientSaleId);
        return isOtc && (charge.status === 'owed' || charge.status === 'partially_paid' || charge.status === 'paid');
      })
      .slice(0, 40)
      .map((charge) => ({
        chargeId: charge.id,
        saleId: String(charge.metadata?.clientSaleId ?? charge.serviceEntityId ?? charge.id),
        serviceEntityId: charge.serviceEntityId,
        orderNo: String(charge.metadata?.orderNo ?? `OTC-${charge.id.slice(0, 8)}`),
        customerName: charge.patient
          ? `${charge.patient.firstName} ${charge.patient.lastName}`
          : String((charge.metadata?.walkIn as { name?: string } | undefined)?.name ?? 'Walk-in'),
        patientNo: charge.patient?.patientNo ?? null,
        description: charge.serviceDescription,
        amountOwed: Number(charge.amountOwed),
        amountPaid: Number(charge.amountPaid),
        amountWaived: Number(charge.amountWaived),
        status: charge.status,
        createdAt: charge.createdAt,
      }));

    return {
      pharmacyLocation: pharmacyLocation
        ? { id: pharmacyLocation.id, name: pharmacyLocation.name, code: pharmacyLocation.code }
        : null,
      prescriptions: {
        pendingTotal: activeOrders.length,
        opdPending: opdOrders.length,
        ipdPending: ipdOrders.length,
        partialCount: activeOrders.filter((o) => o.status === 'partially_dispensed').length,
        urgentCount: activeOrders.filter((o) => o.priority === 'stat' || o.priority === 'urgent').length,
      },
      otcToday: {
        preparedSalesCount: otcChargesToday.length,
        chargedAmountKes: roundQty(otcChargesToday.reduce((s, c) => s + Number(c.amountOwed), 0)),
        completedPaymentsCount: otcPaymentsToday.length,
        collectedAmountKes: roundQty(otcPaymentsToday.reduce((s, p) => s + Number(p.amount ?? 0), 0)),
        outstandingKes: roundQty(
          otcChargesToday.reduce(
            (s, c) => s + Math.max(0, Number(c.amountOwed) - Number(c.amountPaid) - Number(c.amountWaived)),
            0,
          ),
        ),
      },
      stock: {
        onHand: roundQty(onHandTotal),
        reserved: roundQty(reservedTotal),
        available: roundQty(availableTotal),
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
        nearExpiryCount: nearExpiryBatches.length,
        expiredCount: expiredBatches.length,
        quarantinedCount: null,
        quarantinePolicyNote: 'Quarantine and recall status is not configured in hospital policy.',
      },
      stockTake: {
        pendingSessions,
        awaitingApproval: submittedSessions,
      },
      lowStockItems: lowStockItems.slice(0, 20),
      outOfStockItems: outOfStockItems.slice(0, 20),
      nearExpiryBatches: nearExpiryBatches.slice(0, 20),
      expiredBatches: expiredBatches.slice(0, 20),
      openOtcQueue,
      recentMovements: recentMovements.slice(0, 15).map((m) => ({
        id: m.id,
        transactionType: m.transactionType,
        quantity: Number(m.quantity),
        unit: m.unit,
        itemName: m.item?.name ?? 'Item',
        sku: m.item?.sku ?? '',
        batchNo: m.batch?.batchNo ?? null,
        reason: m.reason,
        createdAt: m.createdAt,
      })),
    };
  }

  async pharmacyStockTable(params?: {
    locationId?: string;
    includeInactive?: boolean;
    request?: RequestContext;
  }) {
    const locations = await this.locations.find({ where: { active: true }, order: { name: 'ASC' } });
    const selectedLocation =
      (params?.locationId ? locations.find((l) => l.id === params.locationId) : null) ??
      locations.find((l) => l.code === 'PHARMACY' || l.locationType === 'pharmacy') ??
      locations[0] ??
      null;

    const items = await this.listItems({
      includeInactive: params?.includeInactive ?? true,
      request: params?.request,
    });

    const batches = selectedLocation
      ? await this.batches.find({
          where: { location: { id: selectedLocation.id } },
          relations: { item: true, location: true },
          order: { expiryDate: 'ASC' },
        })
      : [];

    const held = selectedLocation
      ? await this.reservations.find({
          where: { location: { id: selectedLocation.id }, status: 'held' },
          relations: { batch: true, item: true },
        })
      : [];

    const heldByBatch = new Map<string, number>();
    for (const row of held) {
      heldByBatch.set(row.batch.id, (heldByBatch.get(row.batch.id) ?? 0) + Number(row.quantity));
    }

    const batchesByItem = new Map<string, InventoryBatch[]>();
    for (const batch of batches) {
      if (Number(batch.qtyOnHand) <= 0 && (heldByBatch.get(batch.id) ?? 0) <= 0) continue;
      const list = batchesByItem.get(batch.item.id) ?? [];
      list.push(batch);
      batchesByItem.set(batch.item.id, list);
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const rows: Array<{
      rowId: string;
      itemId: string;
      sku: string;
      name: string;
      genericName: string | null;
      category: string;
      drugClass: string | null;
      strength: string | null;
      dosageForm: string | null;
      unit: string;
      sell: number;
      cost: number;
      currency: string;
      active: boolean;
      trackBatch: boolean;
      minLevel: number | null;
      maxLevel: number | null;
      locationId: string | null;
      locationName: string | null;
      batchId: string | null;
      batchNo: string | null;
      expiryDate: string | null;
      expired: boolean;
      onHand: number;
      reserved: number;
      available: number;
      stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRED' | 'INACTIVE';
    }> = [];

    for (const item of items) {
      const lotList = batchesByItem.get(item.id) ?? [];
      const min = item.minLevel != null && Number.isFinite(Number(item.minLevel)) ? Number(item.minLevel) : 10;
      if (!lotList.length) {
        rows.push({
          rowId: `${item.id}:none`,
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          genericName: null,
          category: item.category,
          drugClass: item.drugClass ?? null,
          strength: item.strength ?? null,
          dosageForm: item.dosageForm ?? null,
          unit: item.unit,
          sell: Number(item.sell ?? 0),
          cost: Number(item.cost ?? 0),
          currency: 'KES',
          active: item.active,
          trackBatch: item.trackBatch,
          minLevel: item.minLevel ?? null,
          maxLevel: item.maxLevel ?? null,
          locationId: selectedLocation?.id ?? null,
          locationName: selectedLocation?.name ?? null,
          batchId: null,
          batchNo: null,
          expiryDate: null,
          expired: false,
          onHand: 0,
          reserved: 0,
          available: 0,
          stockStatus: !item.active ? 'INACTIVE' : 'OUT_OF_STOCK',
        });
        continue;
      }

      for (const batch of lotList) {
        const onHand = roundQty(Number(batch.qtyOnHand));
        const reserved = roundQty(heldByBatch.get(batch.id) ?? 0);
        const expired = Boolean(batch.expiryDate && batch.expiryDate < todayIso);
        const available = expired ? 0 : Math.max(0, roundQty(onHand - reserved));
        const stockStatus = !item.active
          ? 'INACTIVE'
          : expired
            ? 'EXPIRED'
            : available <= 0
              ? 'OUT_OF_STOCK'
              : available <= min
                ? 'LOW_STOCK'
                : 'IN_STOCK';
        rows.push({
          rowId: `${item.id}:${batch.id}`,
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          genericName: null,
          category: item.category,
          drugClass: item.drugClass ?? null,
          strength: item.strength ?? null,
          dosageForm: item.dosageForm ?? null,
          unit: item.unit,
          sell: Number(item.sell ?? 0),
          cost: Number(item.cost ?? 0),
          currency: 'KES',
          active: item.active,
          trackBatch: item.trackBatch,
          minLevel: item.minLevel ?? null,
          maxLevel: item.maxLevel ?? null,
          locationId: selectedLocation?.id ?? null,
          locationName: selectedLocation?.name ?? null,
          batchId: batch.id,
          batchNo: batch.batchNo,
          expiryDate: batch.expiryDate ?? null,
          expired,
          onHand,
          reserved,
          available,
          stockStatus,
        });
      }
    }

    return {
      selectedLocation: selectedLocation
        ? { id: selectedLocation.id, name: selectedLocation.name, code: selectedLocation.code }
        : null,
      locations: locations.map((l) => ({ id: l.id, name: l.name, code: l.code, locationType: l.locationType })),
      rows,
    };
  }

  listStockTakeSessions() {
    return this.stockTakeSessions.find({
      relations: { location: true, lines: { item: true, batch: true } },
      order: { createdAt: 'DESC' },
      take: 50,
    }).then((rows) => rows.map((row) => this.serializeStockTakeSession(row)));
  }

  async getStockTakeSession(id: string) {
    const session = await this.stockTakeSessions.findOne({
      where: { id },
      relations: { location: true, lines: { item: true, batch: true } },
    });
    if (!session) throw domainNotFound(ERROR_CODES.NOT_FOUND, 'Stock-take session was not found.');
    session.lines = [...(session.lines ?? [])].sort((a, b) => a.item.name.localeCompare(b.item.name));
    return this.serializeStockTakeSession(session);
  }

  async exportPhysicalCountSheet(id: string) {
    const session = await this.stockTakeSessions.findOne({
      where: { id },
      relations: { location: true, lines: { item: true, batch: true } },
    });
    if (!session) throw domainNotFound(ERROR_CODES.NOT_FOUND, 'Stock-take session was not found.');
    const header = [
      'session_id',
      'line_id',
      'sku',
      'name',
      'batch_no',
      'expiry',
      'book_qty',
      'physical_count',
      'variance_reason',
    ];
    const rows = (session.lines ?? []).map((line) =>
      [
        csvEscape(session.id),
        csvEscape(line.id),
        csvEscape(line.item?.sku ?? ''),
        csvEscape(line.item?.name ?? ''),
        csvEscape(line.batch?.batchNo ?? ''),
        csvEscape(line.batch?.expiryDate ?? ''),
        csvEscape(Number(line.expectedQty)),
        '',
        csvEscape(line.reason ?? ''),
      ].join(','),
    );
    return `${header.join(',')}\n${rows.join('\n')}\n`;
  }

  async importCountsIntoSession(id: string, dto: ImportStockTakeCountsDto, request: RequestContext) {
    const session = await this.stockTakeSessions.findOne({
      where: { id },
      relations: { lines: { item: true, batch: true } },
    });
    if (!session) throw domainNotFound(ERROR_CODES.NOT_FOUND, 'Stock-take session was not found.');
    assertCanCount(session.status);
    const rows = parseInventoryCsv(dto.csv);
    if (!rows.length) {
      throw domainBadRequest(ERROR_CODES.STOCK_TAKE_INVALID, 'The count sheet is empty or missing a header row.');
    }
    let applied = 0;
    const errors: string[] = [];
    for (const [index, row] of rows.entries()) {
      const lineNo = index + 2;
      const countedRaw = row.counted_qty ?? '';
      if (!countedRaw.trim()) continue;
      const counted = Number(countedRaw);
      if (!Number.isFinite(counted) || counted < 0) {
        errors.push(`Line ${lineNo}: physical_count must be a number 0 or greater.`);
        continue;
      }
      const lineId = row.line_id?.trim() ?? '';
      const sku = row.sku?.trim().toUpperCase() ?? '';
      const batchNo = row.batch_no?.trim() ?? '';
      const byId = lineId ? session.lines.filter((line) => line.id === lineId) : [];
      const bySkuBatch = !byId.length
        ? session.lines.filter((line) => {
            if (!sku || line.item?.sku?.toUpperCase() !== sku) return false;
            if (batchNo) return (line.batch?.batchNo ?? '') === batchNo;
            return true;
          })
        : [];
      const candidates = byId.length ? byId : bySkuBatch;
      if (!candidates.length) {
        errors.push(`Line ${lineNo}: unknown product or batch for ${row.sku || row.line_id || 'row'}.`);
        continue;
      }
      if (candidates.length > 1) {
        errors.push(
          `Line ${lineNo}: ambiguous match for ${row.sku || 'item'} (${candidates.length} lots in session). Include line_id or batch_no.`,
        );
        continue;
      }
      const match = candidates[0];
      if (row.unit?.trim() && match.item?.unit && row.unit.trim().toLowerCase() !== match.item.unit.toLowerCase()) {
        errors.push(
          `Line ${lineNo}: unit "${row.unit.trim()}" does not match catalogue unit "${match.item.unit}" for ${match.item.sku}.`,
        );
        continue;
      }
      const expected = roundQty(Number(match.expectedQty));
      const qty = roundQty(counted);
      try {
        assertVarianceReason(expected, qty, row.reason);
      } catch (error) {
        errors.push(error instanceof Error ? `Line ${lineNo}: ${error.message}` : `Line ${lineNo}: reason required.`);
        continue;
      }
      match.countedQty = String(qty);
      match.varianceQty = String(stockVariance(qty, expected));
      match.reason = row.reason?.trim() || null;
      match.updatedBy = request.user?.sub ?? null;
      await this.stockTakeLines.save(match);
      applied += 1;
    }
    if (session.status === 'rejected') {
      session.status = 'open';
      session.updatedBy = request.user?.sub ?? null;
      await this.stockTakeSessions.save(session);
    }
    if (!applied && errors.length) {
      throw domainBadRequest(ERROR_CODES.STOCK_TAKE_INVALID, errors[0]);
    }
    const result = await this.getStockTakeSession(id);
    return { ...result, imported: applied, errors };
  }

  async createStockTakeSession(dto: CreateStockTakeSessionDto, request: RequestContext) {
    const location = await this.locations.findOne({ where: { id: dto.locationId, active: true } });
    if (!location) throw domainNotFound(ERROR_CODES.NOT_FOUND, 'Count location was not found.');
    const open = await this.stockTakeSessions.findOne({
      where: [
        { location: { id: location.id }, status: 'open' },
        { location: { id: location.id }, status: 'submitted' },
        { location: { id: location.id }, status: 'rejected' },
      ],
    });
    if (open) {
      throw domainConflict(
        ERROR_CODES.STOCK_TAKE_INVALID,
        'This location already has an unfinished stock-take session.',
        { nextAction: 'Finish, reject, or post the open session before starting another count.' },
      );
    }
    const actor = request.user?.sub ?? null;
    const session = await this.items.manager.transaction(async (manager) => {
      const sessions = manager.getRepository(InventoryStockTakeSession);
      const lines = manager.getRepository(InventoryStockTakeLine);
      const batches = manager.getRepository(InventoryBatch);
      const saved = await sessions.save(
        sessions.create({
          location,
          status: 'open',
          baselineAt: new Date(),
          notes: dto.notes?.trim() || null,
          createdBy: actor,
          updatedBy: actor,
        }),
      );
      const lots = await batches.find({
        where: { location: { id: location.id } },
        relations: { item: true, location: true },
        order: { expiryDate: 'ASC' },
      });
      for (const batch of lots) {
        if (Number(batch.qtyOnHand) <= 0) continue;
        await lines.save(
          lines.create({
            session: saved,
            item: batch.item,
            batch,
            expectedQty: String(roundQty(Number(batch.qtyOnHand))),
            countedQty: null,
            varianceQty: null,
            reason: null,
            createdBy: actor,
            updatedBy: actor,
          }),
        );
      }
      return saved;
    });
    return this.getStockTakeSession(session.id);
  }

  async countStockTakeLine(sessionId: string, lineId: string, dto: CountStockTakeLineDto, request: RequestContext) {
    const session = await this.stockTakeSessions.findOne({
      where: { id: sessionId },
      relations: { lines: true },
    });
    if (!session) throw domainNotFound(ERROR_CODES.NOT_FOUND, 'Stock-take session was not found.');
    assertCanCount(session.status);
    const line = session.lines.find((row) => row.id === lineId);
    if (!line) throw domainNotFound(ERROR_CODES.NOT_FOUND, 'Stock-take line was not found.');
    const counted = roundQty(Number(dto.countedQty));
    const expected = roundQty(Number(line.expectedQty));
    assertVarianceReason(expected, counted, dto.reason);
    line.countedQty = String(counted);
    line.varianceQty = String(stockVariance(counted, expected));
    line.reason = dto.reason?.trim() || null;
    line.updatedBy = request.user?.sub ?? null;
    if (session.status === 'rejected') {
      session.status = 'open';
      session.updatedBy = request.user?.sub ?? null;
      await this.stockTakeSessions.save(session);
    }
    await this.stockTakeLines.save(line);
    return this.getStockTakeSession(sessionId);
  }

  async submitStockTakeSession(id: string, request: RequestContext) {
    const session = await this.stockTakeSessions.findOne({
      where: { id },
      relations: { lines: true },
    });
    if (!session) throw domainNotFound(ERROR_CODES.NOT_FOUND, 'Stock-take session was not found.');
    assertCanSubmit(session.status);
    if (!session.lines.length) {
      throw domainBadRequest(ERROR_CODES.STOCK_TAKE_INVALID, 'There is no baseline stock to count at this location.');
    }
    const missing = session.lines.filter((line) => line.countedQty == null);
    if (missing.length) {
      throw domainBadRequest(
        ERROR_CODES.STOCK_TAKE_INVALID,
        `${missing.length} line(s) still have no physical count.`,
        { nextAction: 'Enter a counted quantity for every line, including zeros, then submit.' },
      );
    }
    for (const line of session.lines) {
      assertVarianceReason(Number(line.expectedQty), Number(line.countedQty), line.reason);
    }
    session.status = 'submitted';
    session.submittedBy = request.user?.sub ?? null;
    session.submittedAt = new Date();
    session.updatedBy = request.user?.sub ?? null;
    await this.stockTakeSessions.save(session);
    return this.getStockTakeSession(id);
  }

  async rejectStockTakeSession(id: string, dto: RejectStockTakeDto, request: RequestContext) {
    const session = await this.stockTakeSessions.findOne({ where: { id } });
    if (!session) throw domainNotFound(ERROR_CODES.NOT_FOUND, 'Stock-take session was not found.');
    assertCanReject(session.status);
    if (!dto.reason?.trim()) {
      throw domainBadRequest(ERROR_CODES.STOCK_TAKE_INVALID, 'A reject reason is required.');
    }
    session.status = 'rejected';
    session.rejectedBy = request.user?.sub ?? null;
    session.rejectedAt = new Date();
    session.rejectReason = dto.reason.trim();
    session.updatedBy = request.user?.sub ?? null;
    await this.stockTakeSessions.save(session);
    return this.getStockTakeSession(id);
  }

  async approveAndPostStockTakeSession(id: string, request: RequestContext) {
    const actor = request.user?.sub ?? null;
    return this.items.manager.transaction(async (manager) => {
      const sessions = manager.getRepository(InventoryStockTakeSession);
      await sessions.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      const session = await sessions.findOne({
        where: { id },
        relations: { location: true, lines: { item: true, batch: true } },
      });
      if (!session) throw domainNotFound(ERROR_CODES.NOT_FOUND, 'Stock-take session was not found.');
      if (session.status === 'posted') {
        return this.serializeStockTakeSession(session);
      }
      if (session.status !== 'submitted') {
        throw domainBadRequest(
          ERROR_CODES.STOCK_TAKE_INVALID,
          `Only a submitted session can be posted. Current status is ${session.status}.`,
        );
      }
      assertIndependentApprover(session.submittedBy, actor);
      await this.claimImportSession(manager, session.id, 'stock_take');
      for (const line of session.lines) {
        const expected = roundQty(Number(line.expectedQty));
        const counted = roundQty(Number(line.countedQty ?? NaN));
        if (!Number.isFinite(counted)) {
          throw domainBadRequest(ERROR_CODES.STOCK_TAKE_INVALID, 'Every line must have a counted quantity before posting.');
        }
        assertVarianceReason(expected, counted, line.reason);
        const variance = stockVariance(counted, expected);
        if (variance === 0) continue;
        const batchNo = line.batch?.batchNo ?? null;
        const actual = await this.quantityOnHand(line.item.id, session.location.id, batchNo, manager);
        try {
          assertFreshSnapshot(expected, actual);
        } catch (error) {
          throw domainConflict(
            ERROR_CODES.STOCK_TAKE_INVALID,
            error instanceof Error ? error.message : 'On-hand changed since the baseline. Recount before posting.',
            { nextAction: 'Reject this session, recount against the live quantity, then submit again.' },
          );
        }
        await this.adjustOnHand({
          manager,
          item: line.item,
          location: session.location,
          variance,
          batchNo,
          expiryDate: line.batch?.expiryDate ?? null,
          sessionId: session.id,
          reason:
            line.reason ||
            `Stock-take ${line.item.sku}: counted ${counted}, baseline ${expected}, variance ${variance}`,
          request,
        });
      }
      session.status = 'posted';
      session.approvedBy = actor;
      session.approvedAt = new Date();
      session.postedAt = new Date();
      session.updatedBy = actor;
      await sessions.save(session);
      return this.serializeStockTakeSession(
        (await sessions.findOne({
          where: { id: session.id },
          relations: { location: true, lines: { item: true, batch: true } },
        })) ?? session,
      );
    });
  }

  private serializeStockTakeSession(session: InventoryStockTakeSession) {
    const lines = (session.lines ?? []).map((line) => ({
      id: line.id,
      itemId: line.item?.id,
      sku: line.item?.sku,
      name: line.item?.name,
      batchId: line.batch?.id ?? null,
      batchNo: line.batch?.batchNo ?? null,
      expiryDate: line.batch?.expiryDate ?? null,
      expectedQty: Number(line.expectedQty),
      countedQty: line.countedQty == null ? null : Number(line.countedQty),
      varianceQty: line.varianceQty == null ? null : Number(line.varianceQty),
      reason: line.reason,
    }));
    return {
      id: session.id,
      status: session.status,
      notes: session.notes,
      baselineAt: session.baselineAt,
      submittedBy: session.submittedBy,
      submittedAt: session.submittedAt,
      rejectedBy: session.rejectedBy,
      rejectedAt: session.rejectedAt,
      rejectReason: session.rejectReason,
      approvedBy: session.approvedBy,
      approvedAt: session.approvedAt,
      postedAt: session.postedAt,
      location: session.location
        ? { id: session.location.id, name: session.location.name, code: session.location.code }
        : null,
      lines,
      totals: {
        lines: lines.length,
        counted: lines.filter((line) => line.countedQty != null).length,
        variances: lines.filter((line) => (line.varianceQty ?? 0) !== 0).length,
      },
    };
  }

  private async readPricingMap(request?: RequestContext): Promise<Record<string, ItemPrice>> {
    const settings = await this.loadSettings(request);
    const raw = (settings?.clinicalCatalog as { inventoryPricing?: Record<string, ItemPrice> } | undefined)
      ?.inventoryPricing;
    return raw && typeof raw === 'object' ? raw : {};
  }

  private async writePricing(
    sku: string,
    price: ItemPrice,
    request: RequestContext,
    manager?: EntityManager,
  ) {
    const settings = await this.loadSettings(request, manager);
    if (!settings) {
      throw new BadRequestException('Hospital settings are missing — cannot save prices.');
    }
    const catalog = { ...(settings.clinicalCatalog ?? {}) } as Record<string, unknown>;
    const pricing = {
      ...((catalog.inventoryPricing as Record<string, ItemPrice> | undefined) ?? {}),
      [sku]: price,
    };
    catalog.inventoryPricing = pricing;
    const repo = manager ? manager.getRepository(TenantSettings) : this.settings;
    await repo.update(settings.id, {
      clinicalCatalog: catalog as never,
      updatedBy: request.user?.sub ?? null,
    });
  }

  private async loadSettings(request?: RequestContext, manager?: EntityManager) {
    const tenantId = request?.tenant?.id;
    if (!tenantId) return null;
    const repo = manager ? manager.getRepository(TenantSettings) : this.settings;
    return repo.findOne({ where: { tenant: { id: tenantId } } });
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

  private strengthColumnsReady?: boolean;

  private async hasStrengthColumns() {
    if (this.strengthColumnsReady != null) return this.strengthColumnsReady;
    const rows = (await this.items.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'demo'
          AND table_name = 'inventory_items'
          AND column_name IN ('strength', 'dosage_form')`,
    )) as Array<{ column_name: string }>;
    this.strengthColumnsReady = rows.length === 2;
    return this.strengthColumnsReady;
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

function normalizeInventoryCategory(value?: string, name?: string): InventoryCategory {
  const raw = (value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  if (raw === 'pharmaceutical' || raw === 'pharmacy' || raw === 'medicine' || raw === 'drug' || raw === 'drugs') {
    return 'pharmaceutical';
  }
  if (raw === 'medical_consumable' || raw === 'consumable' || raw === 'consumables') {
    return 'medical_consumable';
  }
  if (raw === 'non_medical' || raw === 'non-medical') return 'non_medical';
  if (classifyDrug(name ?? '', 'pharmaceutical') === 'medical_consumable') {
    return 'medical_consumable';
  }
  return 'pharmaceutical';
}

export function skuFromName(name: string) {
  const compact = name.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 18);
  return compact || 'ITEM';
}

function inferUnit(name: string) {
  const lower = name.toLowerCase();
  if (/\b(tab|tablet)s?\b/.test(lower)) return 'tablet';
  if (/\b(cap|capsule)s?\b/.test(lower)) return 'capsule';
  if (/\b(syrup|suspension|ml)\b/.test(lower)) return 'bottle';
  if (/\b(inj|injection|amp)\b/.test(lower)) return 'ampoule';
  if (/\b(cream|ointment|gel)\b/.test(lower)) return 'tube';
  if (/\b(pair|glove)s?\b/.test(lower)) return 'pair';
  if (/\b(box|pack)\b/.test(lower)) return 'box';
  return 'unit';
}

export function isExpiredBatch(expiryDate?: string | Date | null, now = new Date()) {
  if (!expiryDate) return false;
  const raw = typeof expiryDate === 'string' ? expiryDate.slice(0, 10) : expiryDate.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const today = now.toISOString().slice(0, 10);
  return raw < today;
}

function parseBool(value?: string) {
  const raw = (value ?? '').trim().toLowerCase();
  if (!raw) return undefined;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y';
}

export function parseInventoryCsv(csv: string): Array<Record<string, string>> {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((header) => aliasInventoryHeader(header));
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? '').trim();
    });
    return row;
  });
}

export function aliasInventoryHeader(header: string) {
  const key = header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const aliases: Record<string, string> = {
    name_of_the_item: 'name',
    item_name: 'name',
    item: 'name',
    medicine: 'name',
    drug: 'name',
    qty: 'opening_qty',
    quantity: 'opening_qty',
    qty_on_hand: 'opening_qty',
    counted_qty: 'counted_qty',
    counted: 'counted_qty',
    physical_qty: 'counted_qty',
    physical_count: 'counted_qty',
    variance_reason: 'reason',
    reason: 'reason',
    line_id: 'line_id',
    session_id: 'session_id',
    system_qty: 'system_qty',
    system_quantity: 'system_qty',
    item_id: 'item_id',
    product_id: 'item_id',
    rate: 'sell',
    selling_price: 'sell',
    unit_price: 'sell',
    price: 'sell',
    batch: 'batch_no',
    batch_no: 'batch_no',
    batch_number: 'batch_no',
    expiry_date: 'expiry',
    exp: 'expiry',
    class: 'drug_class',
    therapeutic_class: 'drug_class',
    category_name: 'category',
    generic_name: 'generic_name',
    generic: 'generic_name',
    strength: 'strength',
    dosage_form: 'dosage_form',
    form: 'dosage_form',
    reorder_level: 'min_level',
    min_level: 'min_level',
    max_level: 'max_level',
    barcode: 'sku',
    sku_code: 'sku',
  };
  return aliases[key] ?? key;
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
