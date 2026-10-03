import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  BiometricAgentPayload,
  BiometricProvider,
} from './biometric-provider.interface';

const ALLOWED_RESULTS = new Set([
  'verified',
  'not_verified',
  'no_match',
  'multiple_candidates',
  'device_error',
  'timeout',
  'cancelled',
  'enrolled',
]);

/**
 * Adapter for HID DigitalPersona 4500.
 * Matching and capture run on the workstation agent via the official HID SDK.
 * This class must not import DigitalPersona SDK types.
 */
@Injectable()
export class DigitalPersonaProvider implements BiometricProvider {
  readonly providerId = 'digitalpersona_4500';

  validatePayload(payload: BiometricAgentPayload): BiometricAgentPayload {
    if (!payload?.deviceKey?.trim()) {
      throw new BadRequestException('Device key is required');
    }
    if (!ALLOWED_RESULTS.has(payload.result)) {
      throw new BadRequestException('Unsupported biometric result from the workstation agent');
    }
    if (payload.capturedAt) {
      const captured = Date.parse(payload.capturedAt);
      if (Number.isNaN(captured) || Math.abs(Date.now() - captured) > 90_000) {
        throw new BadRequestException('Biometric capture expired or timestamp is invalid');
      }
    }
    return payload;
  }

  getDeviceStatus(payload: BiometricAgentPayload) {
    return {
      provider: this.providerId,
      sdk: 'HID DigitalPersona Workstation / HID Biometric SDK (official)',
      note:
        payload.lastError ||
        'Capture and matching are performed by the local Jalaram biometric agent, not by this API.',
    };
  }
}
