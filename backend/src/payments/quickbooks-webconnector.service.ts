import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { QuickbooksSyncQueueItem } from './payment.entities';

@Injectable()
export class QuickbooksWebConnectorService {
  private readonly logger = new Logger(QuickbooksWebConnectorService.name);
  private readonly tickets = new Map<string, number>();

  constructor(
    @InjectRepository(QuickbooksSyncQueueItem)
    private readonly queue: Repository<QuickbooksSyncQueueItem>,
    private readonly config: ConfigService,
  ) {}

  async handleSoapRequest(rawSoap: string, _request: RequestContext) {
    const action = this.detectSoapAction(rawSoap);

    if (action === 'authenticate') {
      return this.authenticate(rawSoap);
    }

    if (action === 'serverVersion') {
      return this.soapResponse('serverVersion', '<serverVersionResult>1.0</serverVersionResult>');
    }

    if (action === 'clientVersion') {
      return this.soapResponse('clientVersion', '<clientVersionResult></clientVersionResult>');
    }

    if (!this.isValidTicket(this.extractStr(rawSoap, 'ticket') ?? this.extractStr(rawSoap, 'strTicket'))) {
      this.logger.warn('QBWC request rejected: invalid or missing ticket');
      if (action === 'getLastError') {
        return this.soapResponse('getLastError', '<getLastErrorResult>Not authenticated</getLastErrorResult>');
      }
      return this.soapResponse(action, `<${action}Result></${action}Result>`);
    }

    if (action === 'sendRequestXML') {
      const pending = await this.queue.findOne({
        where: { status: 'pending' },
        order: { createdAt: 'ASC' },
      });
      if (!pending) {
        return this.soapResponse('sendRequestXML', '<sendRequestXMLResult></sendRequestXMLResult>');
      }
      const qbxml = this.buildQbXml(pending);
      return this.soapResponse(
        'sendRequestXML',
        `<sendRequestXMLResult>${this.escapeXml(qbxml)}</sendRequestXMLResult>`,
      );
    }

    if (action === 'receiveResponseXML') {
      const txnId = this.extractTicket(rawSoap);
      const pending = await this.queue.findOne({
        where: { status: 'pending' },
        order: { createdAt: 'ASC' },
      });
      if (pending) {
        await this.queue.update(pending.id, {
          status: txnId ? 'synced' : 'failed',
          syncedAt: txnId ? new Date() : null,
          quickbooksTxnId: txnId,
          errorMessage: txnId ? null : 'QBWC response contained no TxnID',
        });
      }
      return this.soapResponse('receiveResponseXML', '<receiveResponseXMLResult>100</receiveResponseXMLResult>');
    }

    if (action === 'closeConnection') {
      return this.soapResponse('closeConnection', '<closeConnectionResult>OK</closeConnectionResult>');
    }

    if (action === 'getLastError') {
      return this.soapResponse('getLastError', '<getLastErrorResult></getLastErrorResult>');
    }

    return this.soapResponse('serverVersion', '<serverVersionResult>1.0</serverVersionResult>');
  }

  private authenticate(rawSoap: string) {
    const user = this.extractStr(rawSoap, 'strUserName') ?? this.extractStr(rawSoap, 'userName') ?? '';
    const password = this.extractStr(rawSoap, 'strPassword') ?? this.extractStr(rawSoap, 'password') ?? '';
    const expectedUser = this.config.get<string>('QBWC_USER')?.trim() ?? '';
    const expectedPassword = this.config.get<string>('QBWC_PASSWORD')?.trim() ?? '';
    if (!expectedUser || !expectedPassword) {
      this.logger.warn('QBWC credentials are not configured; authenticate rejected');
      return this.authFailure();
    }
    if (!this.safeEqual(user, expectedUser) || !this.safeEqual(password, expectedPassword)) {
      return this.authFailure();
    }
    const ticket = this.issueTicket();
    return this.soapResponse(
      'authenticate',
      `<AuthenticateResult><string>${ticket}</string><string></string></AuthenticateResult>`,
    );
  }

  private authFailure() {
    return this.soapResponse(
      'authenticate',
      '<AuthenticateResult><string></string><string>nvu</string></AuthenticateResult>',
    );
  }

  private issueTicket() {
    const secret = this.config.get<string>('QBWC_PASSWORD')?.trim() ?? '';
    if (!secret) {
      throw new Error('QBWC_PASSWORD is not configured');
    }
    const ticket = randomBytes(24).toString('hex');
    const signed = createHmac('sha256', secret).update(ticket).digest('hex');
    const value = `${ticket}.${signed.slice(0, 16)}`;
    this.tickets.set(value, Date.now() + 60 * 60 * 1000);
    return value;
  }

  private isValidTicket(ticket: string | null) {
    if (!ticket) return false;
    const expires = this.tickets.get(ticket);
    if (!expires) return false;
    if (expires < Date.now()) {
      this.tickets.delete(ticket);
      return false;
    }
    return true;
  }

  private safeEqual(left: string, right: string) {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    if (a.length !== b.length) {
      timingSafeEqual(a, Buffer.alloc(a.length));
      return false;
    }
    return timingSafeEqual(a, b);
  }

  private buildQbXml(item: QuickbooksSyncQueueItem) {
    const payload = item.payload ?? {};
    if (item.action === 'invoice_add') {
      return `<?xml version="1.0" encoding="utf-8"?>
<?qbxml version="13.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <InvoiceAddRq>
      <InvoiceAdd>
        <CustomerRef><FullName>${payload.patientNo ?? 'Walk-in Patient'}</FullName></CustomerRef>
        <Memo>AfyaSasa lab request ${payload.labRequestId ?? item.entityId}</Memo>
      </InvoiceAdd>
    </InvoiceAddRq>
  </QBXMLMsgsRq>
</QBXML>`;
    }
    return `<?xml version="1.0" encoding="utf-8"?>
<?qbxml version="13.0"?>
<QBXML><QBXMLMsgsRq onError="stopOnError"><HostQueryRq/></QBXMLMsgsRq></QBXML>`;
  }

  private detectSoapAction(soap: string) {
    const match = soap.match(/<(\w+) xmlns="http:\/\/developer\.intuit\.com\/"/);
    if (match) return match[1];
    if (soap.includes('authenticate')) return 'authenticate';
    if (soap.includes('sendRequestXML')) return 'sendRequestXML';
    if (soap.includes('receiveResponseXML')) return 'receiveResponseXML';
    if (soap.includes('closeConnection')) return 'closeConnection';
    if (soap.includes('getLastError')) return 'getLastError';
    if (soap.includes('clientVersion')) return 'clientVersion';
    return 'serverVersion';
  }

  private extractStr(soap: string, tag: string) {
    const match = soap.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'));
    return match?.[1] ?? null;
  }

  private extractTicket(soap: string) {
    const match = soap.match(/<TxnID>([^<]+)<\/TxnID>/);
    return match?.[1] ?? null;
  }

  private escapeXml(value: string) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private soapResponse(method: string, inner: string) {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${method}Response xmlns="http://developer.intuit.com/">
      ${inner}
    </${method}Response>
  </soap:Body>
</soap:Envelope>`;
  }
}
