import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { Public } from '../core/auth/auth.decorators';
import { RequirePermissions } from '../core/auth/auth.decorators';
import { InitiateMpesaStkDto, RecordManualPaymentDto } from './payments.dto';
import { PaymentsService } from './payments.service';
import { QuickbooksWebConnectorService } from './quickbooks-webconnector.service';

@ApiTags('Payments')
@Controller()
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
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
