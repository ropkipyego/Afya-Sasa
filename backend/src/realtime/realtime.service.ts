import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

export type RealtimeEvent =
  | 'vitals.recorded'
  | 'admission.created'
  | 'admission.updated'
  | 'admission.discharged'
  | 'bed.updated'
  | 'settings.updated'
  | 'lab.updated'
  | 'radiology.updated'
  | 'triage.updated'
  | 'notification.created'
  | 'emergency.alert';

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  publish(tenantCode: string, event: RealtimeEvent, payload: Record<string, unknown> = {}) {
    this.gateway.emitToTenant(tenantCode, event, {
      ...payload,
      event,
      at: new Date().toISOString(),
    });
  }
}
