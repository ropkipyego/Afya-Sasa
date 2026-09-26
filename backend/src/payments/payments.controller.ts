import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { Public } from '../core/auth/auth.decorators';
import { RequirePermissions } from '../core/auth/auth.decorators';
import { CreateManualChargeDto, InitiateMpesaStkDto, RecordManualPaymentDto, SaveHospitalChargeCatalogueDto } from './payments.dto';
import { AccommodationChargeService } from './accommodation-charge.service';
import { BillingExceptionsService } from './billing-exceptions.service';
import { PaymentsService } from './payments.service';
import { QuickbooksWebConnectorService } from './quickbooks-webconnector.service';

@ApiTags('Payments')
@Controller()
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly accommodation: AccommodationChargeService,
    private readonly exceptions: BillingExceptionsService,
    private readonly qbwc: QuickbooksWebConnectorService,
  ) {}

  @Post('payments/mpesa/stk-push')
  @ApiBearerAuth()
  @RequirePermissions('payments:initiate')
  initiateStk(@Body() dto: InitiateMpesaStkDto, @Req() request: RequestContext) {
    return this.payments.initiateMpesaStk(dto, request);
  }

  @Post('payments/mpesa/callback')
  @Public()
  mpesaCallback(@Body() body: Record<string, unknown>) {
    return this.payments.handleMpesaCallback(body);
  }

  @Post('payments/manual')
  @ApiBearerAuth()
  @RequirePermissions('payments:initiate')
  recordManual(@Body() dto: RecordManualPaymentDto, @Req() request: RequestContext) {
    return this.payments.recordManualPayment(dto, request);
  }

  @Get('payments/transactions')
  @ApiBearerAuth()
  @RequirePermissions('payments:read', 'payments:initiate')
  listTransactions(@Query('limit') limit?: string, @Query('patientId') patientId?: string) {
    return this.payments.listTransactions(limit ? Number(limit) : 50, patientId);
  }

  @Get('payments/outstanding')
  @ApiBearerAuth()
  @RequirePermissions('payments:read', 'payments:initiate')
  listOutstanding(@Query('patientId') patientId?: string) {
    if (!patientId) return [];
    return this.payments.listOutstandingPharmacy(patientId);
  }

  @Get('payments/charges')
  @ApiBearerAuth()
  @RequirePermissions('payments:read', 'payments:initiate', 'patients:history')
  listCharges(@Query('patientId') patientId?: string) {
    if (!patientId) return [];
    return this.payments.listCharges(patientId);
  }

  @Get('payments/charge-catalogue')
  @ApiBearerAuth()
  @RequirePermissions('payments:read', 'payments:initiate', 'settings:manage')
  chargeCatalogue(
    @Req() request: RequestContext,
    @Query('q') q?: string,
    @Query('department') department?: string,
    @Query('review') review?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('all') all?: string,
  ) {
    if (all === '1') return this.accommodation.getCatalogue(request);
    return this.accommodation.listCataloguePage(request, {
      q,
      department,
      review,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 25,
    });
  }

  @Patch('payments/charge-catalogue')
  @ApiBearerAuth()
  @RequirePermissions('settings:manage', 'payments:manage')
  saveChargeCatalogue(@Body() dto: SaveHospitalChargeCatalogueDto, @Req() request: RequestContext) {
    return this.accommodation.saveCatalogue(dto as never, request);
  }

  @Get('payments/charges/accommodation/job')
  @ApiBearerAuth()
  @RequirePermissions('payments:read', 'settings:manage', 'admissions:read')
  accommodationJob(@Req() request: RequestContext) {
    return this.accommodation.jobStatus(request);
  }

  @Post('payments/charges/accommodation/process')
  @ApiBearerAuth()
  @RequirePermissions('payments:manage', 'settings:manage')
  processAccommodation(
    @Req() request: RequestContext,
    @Query('admissionId') admissionId?: string,
  ) {
    return this.accommodation.processEligibleAdmissions(request, admissionId);
  }

  @Get('payments/admissions/:id/account')
  @ApiBearerAuth()
  @RequirePermissions('payments:read', 'payments:initiate', 'admissions:read', 'patients:history')
  admissionAccount(@Param('id') id: string) {
    return this.accommodation.admissionAccount(id);
  }

  @Get('payments/charges/summary')
  @ApiBearerAuth()
  @RequirePermissions('payments:read', 'reports:read', 'admissions:read')
  chargeSummary(
    @Query('scope') scope?: 'all' | 'ipd',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.accommodation.financialSummary(scope === 'ipd' ? 'ipd' : 'all', from, to);
  }

  @Post('payments/charge-catalogue/import/preview')
  @ApiBearerAuth()
  @RequirePermissions('settings:manage', 'payments:manage')
  previewCatalogueImport(
    @Body() body: { rows?: Array<Record<string, unknown>> },
    @Req() request: RequestContext,
  ) {
    return this.accommodation.previewCatalogueImport((body.rows ?? []) as never, request);
  }

  @Post('payments/charge-catalogue/import/confirm')
  @ApiBearerAuth()
  @RequirePermissions('settings:manage', 'payments:manage')
  confirmCatalogueImport(
    @Body() body: { rows?: Array<Record<string, unknown>> },
    @Req() request: RequestContext,
  ) {
    return this.accommodation.confirmCatalogueImport((body.rows ?? []) as never, request);
  }

  @Get('payments/exceptions')
  @ApiBearerAuth()
  @RequirePermissions('payments:read', 'reports:read', 'settings:manage')
  billingExceptions() {
    return this.exceptions.listExceptions();
  }

  @Get('payments/charges/ipd-census')
  @ApiBearerAuth()
  @RequirePermissions('admissions:read', 'payments:read')
  ipdCensus() {
    return this.accommodation.ipdCensus();
  }

  @Post('payments/charges/:id/adjust')
  @ApiBearerAuth()
  @RequirePermissions('payments:manage')
  adjustCharge(
    @Param('id') id: string,
    @Body() body: { type: 'waiver' | 'discount' | 'refund'; amount: number; reason: string },
    @Req() request: RequestContext,
  ) {
    return this.accommodation.adjustCharge(id, body, request);
  }

  @Post('payments/cashier/close')
  @ApiBearerAuth()
  @RequirePermissions('payments:manage')
  closeCashier(@Req() request: RequestContext) {
    return this.accommodation.closeCashier(request);
  }

  @Post('payments/charges/manual')
  @ApiBearerAuth()
  @RequirePermissions('payments:initiate', 'payments:manage')
  createManualCharge(@Body() dto: CreateManualChargeDto, @Req() request: RequestContext) {
    return this.accommodation.createManualCharge(dto, request);
  }

  @Get('integrations/quickbooks/queue')
  @ApiBearerAuth()
  @RequirePermissions('payments:manage')
  listQbQueue(@Query('status') status?: 'pending' | 'synced' | 'failed') {
    return this.payments.listQuickbooksQueue(status);
  }

  @Patch('integrations/quickbooks/queue/:id/synced')
  @ApiBearerAuth()
  @RequirePermissions('payments:manage')
  markQbSynced(@Param('id') id: string, @Body() body: { quickbooksTxnId: string }) {
    return this.payments.markQuickbooksSynced(id, body.quickbooksTxnId);
  }

  @Post('integrations/quickbooks/webconnector')
  @Public()
  async webConnector(@Body() body: string, @Req() req: RequestContext) {
    const soapBody = typeof body === 'string' ? body : JSON.stringify(body);
    return this.qbwc.handleSoapRequest(soapBody, req);
  }
}
