import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { QuickbooksSyncQueueItem } from './payment.entities';

/**
 * QuickBooks Desktop v14 sync via Web Connector (QBWC).
 * This service exposes a minimal SOAP-compatible handler and a pending queue
 * that QBWC polls. Full QBXML generation can be extended per hospital chart of accounts.
 */
@Injectable()
export class QuickbooksWebConnectorService {
  /** Item currently handed to QBWC in sendRequestXML — synced on receiveResponseXML. */
  private activeSyncItemId: string | null = null;

  constructor(
    @InjectRepository(QuickbooksSyncQueueItem)
    private readonly queue: Repository<QuickbooksSyncQueueItem>,
  ) {}

  async handleSoapRequest(rawSoap: string, _request: RequestContext) {
    const action = this.detectSoapAction(rawSoap);

    if (action === 'authenticate') {
      return this.soapResponse('authenticate', `<AuthenticateResult><string>afyasasa-token</string><string></string></AuthenticateResult>`);
    }

    if (action === 'sendRequestXML') {
      const pending = await this.queue.findOne({
        where: { status: 'pending' },
        order: { createdAt: 'ASC' },
      });
      if (!pending) {
        this.activeSyncItemId = null;
        return this.soapResponse('sendRequestXML', '<sendRequestXMLResult></sendRequestXMLResult>');
      }
      this.activeSyncItemId = pending.id;
      const qbxml = this.buildQbXml(pending);
      return this.soapResponse('sendRequestXML', `<sendRequestXMLResult>${this.escapeXml(qbxml)}</sendRequestXMLResult>`);
    }

    if (action === 'receiveResponseXML') {
      const ticket = this.extractTicket(rawSoap);
      if (ticket && this.activeSyncItemId) {
        await this.queue.update(this.activeSyncItemId, {
          status: 'synced',
          syncedAt: new Date(),
          quickbooksTxnId: ticket,
        });
        this.activeSyncItemId = null;
      }
      return this.soapResponse('receiveResponseXML', '<receiveResponseXMLResult>100</receiveResponseXMLResult>');
    }

    if (action === 'closeConnection') {
      return this.soapResponse('closeConnection', '<closeConnectionResult>OK</closeConnectionResult>');
    }

    if (action === 'getLastError') {
      return this.soapResponse('getLastError', '<getLastErrorResult></getLastErrorResult>');
    }

    if (action === 'serverVersion') {
      return this.soapResponse('serverVersion', '<serverVersionResult>1.0</serverVersionResult>');
    }

    return this.soapResponse('serverVersion', '<serverVersionResult>1.0</serverVersionResult>');
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
    return 'serverVersion';
  }

  private extractTicket(soap: string) {
    const match = soap.match(/<TxnID>([^<]+)<\/TxnID>/);
    return match?.[1] ?? null;
  }

  private escapeXml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
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
