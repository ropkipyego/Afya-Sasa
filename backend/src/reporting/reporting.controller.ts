import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import { AdminService } from '../core/admin/admin.service';
import { TemplateRenderService } from '../documents/template-render.service';
import { MohReportsService } from './moh-reports.service';
import { ReportingService } from './reporting.service';

type PrintTemplateRecord = {
  name?: string
  html?: string
  docxStoragePath?: string
  docxFilename?: string
}

@ApiBearerAuth()
@ApiTags('Reporting')
@Controller('reports')
export class ReportingController {
  constructor(
    private readonly reportingService: ReportingService,
    private readonly mohReports: MohReportsService,
    private readonly adminService: AdminService,
    private readonly templateRender: TemplateRenderService,
  ) {}

  private periodFromQuery(year?: string, month?: string) {
    const now = new Date();
    return {
      year: year ? Number(year) : now.getUTCFullYear(),
      month: month ? Number(month) : now.getUTCMonth() + 1,
    };
  }

  private async facilityContext(request: RequestContext) {
    const settings = await this.adminService.getSettings(request);
    const catalog = (settings.clinicalCatalog ?? {}) as {
      hospitalProfile?: { facilityName?: string; mohFacilityCode?: string }
    };
    return {
      name: catalog.hospitalProfile?.facilityName ?? settings.tenant?.name ?? '',
      mohCode:
        catalog.hospitalProfile?.mohFacilityCode ?? settings.tenant?.mohFacilityCode ?? '',
    };
  }

  private async renderMohDocx(
    res: Response,
    request: RequestContext,
    templateKey: string,
    load: () => Promise<{ templateVariables: Record<string, unknown>; form: string; period: string }>,
  ) {
    const settings = await this.adminService.getSettings(request);
    const catalog = (settings.clinicalCatalog ?? {}) as {
      printTemplates?: Record<string, PrintTemplateRecord>
    };
    const template = catalog.printTemplates?.[templateKey];
    const report = await load();
    if (!template?.docxStoragePath) {
      res.status(404).json({
        message: `Upload a DOCX template for "${templateKey}" in Document Templates (use tags like {facilityName}, {#lines}{condition}{/lines}).`,
      });
      return;
    }
    const buffer = await this.templateRender.renderDocx(
      template.docxStoragePath,
      report.templateVariables,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${template.docxFilename ?? `${templateKey}-${report.period}.docx`}"`,
    );
    res.send(buffer);
  }

  @Get('dashboard')
  @RequirePermissions('reports:read')
  dashboard() {
    return this.reportingService.dashboard();
  }

  @Get('operations')
  @RequirePermissions('reports:read')
  operations() {
    return this.reportingService.operationsCommandCenter();
  }

  @Get('opd-summary')
  @RequirePermissions('reports:read')
  opdSummary() {
    return this.reportingService.opdSummary();
  }

  @Get('admissions')
  @RequirePermissions('reports:read')
  admissionsReport() {
    return this.reportingService.admissionsReport();
  }

  @Get('discharges')
  @RequirePermissions('reports:read')
  dischargesReport() {
    return this.reportingService.dischargesReport();
  }

  @Get('bed-occupancy')
  @RequirePermissions('reports:read')
  bedOccupancyReport() {
    return this.reportingService.bedOccupancyReport();
  }

  @Get('emergency-stats')
  @RequirePermissions('reports:read')
  emergencyStats() {
    return this.reportingService.emergencyStats();
  }

  @Get('disease-register')
  @RequirePermissions('reports:read')
  diseaseRegister() {
    return this.reportingService.diseaseRegister();
  }

  @Get('moh-705')
  @RequirePermissions('reports:read')
  moh705() {
    return this.reportingService.moh705();
  }

  @Get('moh-705a')
  @RequirePermissions('reports:read')
  async moh705a(
    @Req() request: RequestContext,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const period = this.periodFromQuery(year, month);
    const facility = await this.facilityContext(request);
    const data = await this.mohReports.moh705a(period, facility);
    return this.reportingService.wrapMohReport(data);
  }

  @Get('moh-705b')
  @RequirePermissions('reports:read')
  async moh705b(
    @Req() request: RequestContext,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const period = this.periodFromQuery(year, month);
    const facility = await this.facilityContext(request);
    const data = await this.mohReports.moh705b(period, facility);
    return this.reportingService.wrapMohReport(data);
  }

  @Get('moh-706')
  @RequirePermissions('reports:read')
  async moh706(
    @Req() request: RequestContext,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const period = this.periodFromQuery(year, month);
    const facility = await this.facilityContext(request);
    const data = await this.mohReports.moh706(period, facility);
    return this.reportingService.wrapMohReport(data);
  }

  @Get('moh-717')
  @RequirePermissions('reports:read')
  async moh717(
    @Req() request: RequestContext,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const period = this.periodFromQuery(year, month);
    const facility = await this.facilityContext(request);
    const data = await this.mohReports.moh717(period, facility);
    return this.reportingService.wrapMohReport(data);
  }

  @Get('moh-705a/docx')
  @RequirePermissions('reports:read')
  async moh705aDocx(
    @Req() request: RequestContext,
    @Res() res: Response,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const period = this.periodFromQuery(year, month);
    const facility = await this.facilityContext(request);
    await this.renderMohDocx(res, request, 'moh_705a', async () =>
      this.mohReports.moh705a(period, facility),
    );
  }

  @Get('moh-705b/docx')
  @RequirePermissions('reports:read')
  async moh705bDocx(
    @Req() request: RequestContext,
    @Res() res: Response,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const period = this.periodFromQuery(year, month);
    const facility = await this.facilityContext(request);
    await this.renderMohDocx(res, request, 'moh_705b', async () =>
      this.mohReports.moh705b(period, facility),
    );
  }

  @Get('moh-706/docx')
  @RequirePermissions('reports:read')
  async moh706Docx(
    @Req() request: RequestContext,
    @Res() res: Response,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const period = this.periodFromQuery(year, month);
    const facility = await this.facilityContext(request);
    await this.renderMohDocx(res, request, 'moh_706', async () =>
      this.mohReports.moh706(period, facility),
    );
  }

  @Get('moh-717/docx')
  @RequirePermissions('reports:read')
  async moh717Docx(
    @Req() request: RequestContext,
    @Res() res: Response,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const period = this.periodFromQuery(year, month);
    const facility = await this.facilityContext(request);
    await this.renderMohDocx(res, request, 'moh_717', async () =>
      this.mohReports.moh717(period, facility),
    );
  }

  @Get('laboratory')
  @RequirePermissions('reports:read')
  laboratoryReport() {
    return this.reportingService.laboratoryReport();
  }

  @Get('theatre')
  @RequirePermissions('reports:read')
  theatreReport() {
    return this.reportingService.theatreReport();
  }

  @Get('maternity')
  @RequirePermissions('reports:read')
  maternityReport() {
    return this.reportingService.maternityReport();
  }

  @Get('referrals')
  @RequirePermissions('reports:read')
  referralsReport() {
    return this.reportingService.referralsReport();
  }

  @Get('icu')
  @RequirePermissions('reports:read')
  icuReport() {
    return this.reportingService.icuReport();
  }

  @Post('templates/:key/render')
  @RequirePermissions('reports:read')
  async renderTemplate(
    @Param('key') key: string,
    @Body() body: { variables?: Record<string, unknown> },
    @Req() request: RequestContext,
    @Res() res: Response,
  ) {
    const settings = await this.adminService.getSettings(request);
    const catalog = (settings.clinicalCatalog ?? {}) as {
      printTemplates?: Record<string, PrintTemplateRecord>
    };
    const template = catalog.printTemplates?.[key];
    if (!template?.docxStoragePath) {
      res.status(404).json({ message: `No DOCX template uploaded for "${key}".` });
      return;
    }
    const buffer = await this.templateRender.renderDocx(
      template.docxStoragePath,
      body.variables ?? {},
    );
    const filename = template.docxFilename ?? `${key}.docx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
