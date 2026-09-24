import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import {
  CreateInventoryItemDto,
  CreateRequisitionDto,
  CreateTransferDto,
  DispenseOtcDto,
  DispensePharmacyDto,
  DispensePrescriptionDto,
  ImportInventoryCsvDto,
  ReceiveStockDto,
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
  listItems(@Query('category') category?: InventoryItem['category'], @Req() request?: RequestContext) {
    return this.inventoryService.listItems({ category, request });
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

  @Post('dispense/pharmacy')
  @RequirePermissions('pharmacy:dispense', 'inventory:manage')
  dispensePharmacy(@Body() dto: DispensePharmacyDto, @Req() request: RequestContext) {
    return this.inventoryService.dispensePharmacyOrder(dto, request);
  }

  @Post('dispense/prescription')
  @RequirePermissions('pharmacy:dispense', 'inventory:manage')
  dispensePrescription(@Body() dto: DispensePrescriptionDto, @Req() request: RequestContext) {
    return this.inventoryService.dispensePrescription(dto, request);
  }

  @Post('dispense/otc')
  @RequirePermissions('pharmacy:dispense', 'inventory:manage')
  dispenseOtc(@Body() dto: DispenseOtcDto, @Req() request: RequestContext) {
    return this.inventoryService.dispenseOtcSale(dto, request);
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
