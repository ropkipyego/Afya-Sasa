import { Injectable } from '@nestjs/common';
import { emptyMailOverlay, parseMailOverlay, type MailOverlay } from './mail.policy';

@Injectable()
export class MailOverlayStore {
  private overlay: MailOverlay = emptyMailOverlay();

  snapshot(): MailOverlay {
    return {
      ...this.overlay,
      recipientAllowlist: [...this.overlay.recipientAllowlist],
      policies: { ...this.overlay.policies },
    };
  }

  hydrate(raw: unknown) {
    this.overlay = parseMailOverlay(raw);
    return this.snapshot();
  }

  replace(next: MailOverlay) {
    this.overlay = parseMailOverlay(next);
    return this.snapshot();
  }
}
