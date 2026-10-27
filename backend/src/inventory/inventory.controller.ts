import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import {
  CountStockTakeLineDto,
  CreateInventoryItemDto,
  CreateStockTakeSessionDto,
  UpdateInventoryItemDto,
  CreateRequisitionDto,
  CreateTransferDto,
  CancelPharmacySaleDto,
  ReturnIssuedPharmacySaleDto,
  DispenseOtcDto,
  PrepareOtcCartDto,
  DispensePharmacyDto,
  DispensePrescriptionDto,
  PreparePrescriptionDto,
  BulkPricingDto,
  ImportInventoryCsvDto,
  ImportStockTakeCountsDto,
  ReceiveStockDto,
  RejectStockTakeDto,
  UpdateItemPricingDto,
} from './inventory.dto';
import { InventoryItem, InventoryRequisition, InventoryTransfer } from './inventory.entities';
import { InventoryService } from './inventory.service';

@ApiBearerAuth()
@ApiTags('Inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('locations')
  @RequirePermissions('inventory:read', 'pharmacy:read', 'pharmacy:dispense')
  listLocations() {
    return this.inventoryService.listLocations();
  }

  @Get('transactions')
  @RequirePermissions('inventory:read')
  listTransactions(
    @Query('limit') limit?: string,
    @Query('itemId') itemId?: string,
  ) {
    return this.inventoryService.listTransactions({
      limit: limit ? Number(limit) : 100,
      itemId,
    });
  }

  @Get('alerts/low-stock')
  @RequirePermissions('inventory:read', 'pharmacy:read')
  listLowStock() {
    return this.inventoryService.listLowStock();
  }

  @Get('items')
  @RequirePermissions(
    'inventory:read',
    'pharmacy:read',
    'pharmacy:prescribe',
    'consultations:create',
    'payments:initiate',
  )
  listItems(
    @Query('category') category?: InventoryItem['category'],
    @Query('includeInactive') includeInactive?: string,
    @Req() request?: RequestContext,
  ) {
    return this.inventoryService.listItems({
      category,
      includeInactive: includeInactive === 'true' || includeInactive === '1',
      request,
    });
  }

  @Get('barcode/:code')
  @RequirePermissions('inventory:read', 'pharmacy:read', 'inventory:manage', 'pharmacy:dispense')
  lookupBarcode(@Param('code') code: string, @Req() request: RequestContext) {
    return this.inventoryService.lookupByBarcode(decodeURIComponent(code), request);
  }

  @Post('items')
  @RequirePermissions('inventory:manage')
  createItem(@Body() dto: CreateInventoryItemDto, @Req() request: RequestContext) {
    return this.inventoryService.createItem(dto, request);
  }

  @Post('items/import/preview')
  @RequirePermissions('inventory:manage', 'settings:manage')
  previewImport(@Body() dto: ImportInventoryCsvDto, @Req() request: RequestContext) {
    return this.inventoryService.importCatalog({ ...dto, previewOnly: true }, request);
  }

  @Post('items/import')
  @RequirePermissions('inventory:manage', 'settings:manage')
  importItems(@Body() dto: ImportInventoryCsvDto, @Req() request: RequestContext) {
    return this.inventoryService.importCatalog(dto, request);
  }

  @Get('stock-sheet')
  @RequirePermissions('inventory:read', 'pharmacy:read', 'inventory:manage')
  async stockSheet(
    @Query('locationId') locationId: string | undefined,
    @Req() request: RequestContext,
    @Res() response: Response,
  ) {
    const sheet = await this.inventoryService.exportStockSheetCsv(locationId, request);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${sheet.filename}"`);
    response.send(sheet.csv);
  }

  @Get('integrity')
  @RequirePermissions('inventory:read', 'inventory:manage')
  integrity(@Req() request: RequestContext) {
    return this.inventoryService.integrityReport(request);
  }

  @Get('stock-takes')
  @RequirePermissions('inventory:read', 'inventory:manage')
  stockTakes() {
    return this.inventoryService.listStockTakeHistory();
  }

  @Get('oversight-summary')
  @RequirePermissions('inventory:read', 'pharmacy:read')
  oversightSummary() {
    return this.inventoryService.oversightSummary();
  }

  @Get('pharmacy-dashboard')
  @RequirePermissions('pharmacy:read', 'inventory:read')
  pharmacyDashboard(@Req() request: RequestContext) {
    return this.inventoryService.pharmacyDashboard(request);
  }

  @Get('pharmacy-stock-table')
  @RequirePermissions('pharmacy:read', 'inventory:read')
  pharmacyStockTable(
    @Query('locationId') locationId?: string,
    @Query('includeInactive') includeInactive?: string,
    @Req() request?: RequestContext,
  ) {
    return this.inventoryService.pharmacyStockTable({
      locationId,
      includeInactive: includeInactive === 'true' || includeInactive === '1',
      request,
    });
  }

  @Get('stock-take-sessions')
  @RequirePermissions('inventory:read', 'inventory:manage')
  listStockTakeSessions() {
    return this.inventoryService.listStockTakeSessions();
  }

  @Get('stock-take-sessions/:id')
  @RequirePermissions('inventory:read', 'inventory:manage')
  getStockTakeSession(@Param('id') id: string) {
    return this.inventoryService.getStockTakeSession(id);
  }

  @Post('stock-take-sessions')
  @RequirePermissions('inventory:manage')
  createStockTakeSession(@Body() dto: CreateStockTakeSessionDto, @Req() request: RequestContext) {
    return this.inventoryService.createStockTakeSession(dto, request);
  }

  @Get('stock-take-sessions/:id/sheet')
  @RequirePermissions('inventory:read', 'inventory:manage')
  async physicalCountSheet(@Param('id') id: string, @Res() response: Response) {
    const csv = await this.inventoryService.exportPhysicalCountSheet(id);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="physical-count-${id.slice(0, 8)}.csv"`);
    return response.send(csv);
  }

  @Post('stock-take-sessions/:id/import-counts')
  @RequirePermissions('inventory:manage')
  importStockTakeCounts(
    @Param('id') id: string,
    @Body() dto: ImportStockTakeCountsDto,
    @Req() request: RequestContext,
  ) {
    return this.inventoryService.importCountsIntoSession(id, dto, request);
  }

  @Post('stock-take-sessions/:id/lines/:lineId')
  @RequirePermissions('inventory:manage')
  countStockTakeLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: CountStockTakeLineDto,
    @Req() request: RequestContext,
  ) {
    return this.inventoryService.countStockTakeLine(id, lineId, dto, request);
  }

  @Post('stock-take-sessions/:id/submit')
  @RequirePermissions('inventory:manage')
  submitStockTakeSession(@Param('id') id: string, @Req() request: RequestContext) {
    return this.inventoryService.submitStockTakeSession(id, request);
  }

  @Post('stock-take-sessions/:id/reject')
  @RequirePermissions('inventory:manage')
  rejectStockTakeSession(
    @Param('id') id: string,
    @Body() dto: RejectStockTakeDto,
    @Req() request: RequestContext,
  ) {
    return this.inventoryService.rejectStockTakeSession(id, dto, request);
  }

  @Post('stock-take-sessions/:id/approve')
  @RequirePermissions('inventory:manage', 'settings:manage')
  approveStockTakeSession(@Param('id') id: string, @Req() request: RequestContext) {
    return this.inventoryService.approveAndPostStockTakeSession(id, request);
  }

  @Post('pricing/bulk/preview')
  @RequirePermissions('inventory:manage')
  previewBulkPricing(@Body() dto: BulkPricingDto, @Req() request: RequestContext) {
    return this.inventoryService.previewBulkPricing(dto, request);
  }

  @Post('pricing/bulk')
  @RequirePermissions('inventory:manage')
  applyBulkPricing(@Body() dto: BulkPricingDto, @Req() request: RequestContext) {
    return this.inventoryService.applyBulkPricing(dto, request);
  }

  @Patch('items/:id')
  @RequirePermissions('inventory:manage')
  updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemDto,
    @Req() request: RequestContext,
  ) {
    return this.inventoryService.updateItem(id, dto, request);
  }

  @Patch('items/:id/pricing')
  @RequirePermissions('inventory:manage')
  updatePricing(
    @Param('id') id: string,
    @Body() dto: UpdateItemPricingDto,
    @Req() request: RequestContext,
  ) {
    return this.inventoryService.updateItemPricing(id, dto, request);
  }

  @Get('locations/:id/balances')
  @RequirePermissions('inventory:read', 'pharmacy:read', 'pharmacy:dispense')
  locationBalances(@Param('id') id: string) {
    return this.inventoryService.locationBalances(id);
  }

  @Post('receipts')
  @RequirePermissions('inventory:manage')
  receiveStock(@Body() dto: ReceiveStockDto, @Req() request: RequestContext) {
    return this.inventoryService.receiveStock(dto, request);
  }

  @Post('sales/prepare')
  @RequirePermissions('pharmacy:dispense')
  preparePrescription(@Body() dto: PreparePrescriptionDto, @Req() request: RequestContext) {
    return this.inventoryService.preparePrescriptionSale(dto, request);
  }

  @Post('sales/otc/prepare')
  @RequirePermissions('pharmacy:dispense')
  prepareOtc(@Body() dto: PrepareOtcCartDto, @Req() request: RequestContext) {
    return this.inventoryService.prepareOtcSale(dto, request);
  }

  @Get('sales/:saleId')
  @RequirePermissions('pharmacy:dispense', 'pharmacy:read')
  saleStatus(@Param('saleId') saleId: string, @Req() request: RequestContext) {
    return this.inventoryService.pharmacySaleStatus(saleId, request);
  }

  @Post('sales/cancel')
  @RequirePermissions('pharmacy:dispense', 'payments:manage')
  cancelSale(@Body() dto: CancelPharmacySaleDto, @Req() request: RequestContext) {
    return this.inventoryService.cancelPharmacySale(dto, request);
  }

  @Post('sales/return')
  @RequirePermissions('pharmacy:dispense', 'payments:manage')
  returnIssuedSale(@Body() dto: ReturnIssuedPharmacySaleDto, @Req() request: RequestContext) {
    return this.inventoryService.returnIssuedPharmacySale(dto, request);
  }

  @Post('dispense/pharmacy')
  @RequirePermissions('pharmacy:dispense')
  dispensePharmacy(@Body() dto: DispensePharmacyDto, @Req() request: RequestContext) {
    return this.inventoryService.dispensePharmacyOrder(dto, request);
  }

  @Post('dispense/prescription')
  @RequirePermissions('pharmacy:dispense')
  dispensePrescription(@Body() dto: DispensePrescriptionDto, @Req() request: RequestContext) {
    return this.inventoryService.dispensePrescription(dto, request);
  }

  @Post('dispense/retry-billing/:orderId')
  @RequirePermissions('pharmacy:dispense', 'payments:manage')
  retryDispenseBilling(@Param('orderId') orderId: string, @Req() request: RequestContext) {
    return this.inventoryService.retryDispenseBilling(orderId, request);
  }

  @Post('dispense/otc')
  @RequirePermissions('pharmacy:dispense')
  dispenseOtc(@Body() dto: DispenseOtcDto, @Req() request: RequestContext) {
    return this.inventoryService.issueOtcSale(dto, request);
  }

  @Get('requisitions')
  @RequirePermissions('inventory:read')
  listRequisitions(@Query('status') status?: InventoryRequisition['status']) {
    return this.inventoryService.listRequisitions({ status });
  }

  @Get('requisitions/:id')
  @RequirePermissions('inventory:read')
  getRequisition(@Param('id') id: string) {
    return this.inventoryService.getRequisition(id);
  }

  @Post('requisitions')
  @RequirePermissions('inventory:manage')
  createRequisition(@Body() dto: CreateRequisitionDto, @Req() request: RequestContext) {
    return this.inventoryService.createRequisition(dto, request);
  }

  @Post('requisitions/:id/approve')
  @RequirePermissions('inventory:manage')
  approveRequisition(@Param('id') id: string, @Req() request: RequestContext) {
    return this.inventoryService.approveRequisition(id, request);
  }

  @Post('requisitions/:id/issue')
  @RequirePermissions('inventory:manage')
  issueRequisition(@Param('id') id: string, @Req() request: RequestContext) {
    return this.inventoryService.issueRequisition(id, request);
  }

  @Post('requisitions/:id/acknowledge')
  @RequirePermissions('inventory:manage')
  acknowledgeRequisition(@Param('id') id: string, @Req() request: RequestContext) {
    return this.inventoryService.acknowledgeRequisition(id, request);
  }

  @Get('transfers')
  @RequirePermissions('inventory:read')
  listTransfers(@Query('status') status?: InventoryTransfer['status']) {
    return this.inventoryService.listTransfers({ status });
  }

  @Get('transfers/:id')
  @RequirePermissions('inventory:read')
  getTransfer(@Param('id') id: string) {
    return this.inventoryService.getTransfer(id);
  }

  @Post('transfers')
  @RequirePermissions('inventory:manage')
  createTransfer(@Body() dto: CreateTransferDto, @Req() request: RequestContext) {
    return this.inventoryService.createTransfer(dto, request);
  }

  @Post('transfers/:id/ship')
  @RequirePermissions('inventory:manage')
  shipTransfer(@Param('id') id: string, @Req() request: RequestContext) {
    return this.inventoryService.shipTransfer(id, request);
  }

  @Post('transfers/:id/receive')
  @RequirePermissions('inventory:manage')
  receiveTransfer(@Param('id') id: string, @Req() request: RequestContext) {
    return this.inventoryService.receiveTransfer(id, request);
  }
}
