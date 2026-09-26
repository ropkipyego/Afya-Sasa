import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { chargesEnabled } from './charge.entities';
import { AccommodationChargeService } from './accommodation-charge.service';

const INTERVAL_MS = 15 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 45_000;

@Injectable()
export class AccommodationChargeScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccommodationChargeScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly accommodation: AccommodationChargeService) {}

  onModuleInit() {
    if (!chargesEnabled()) {
      this.logger.log('Accommodation charge scheduler idle — charges flag is off.');
      return;
    }
    const first = setTimeout(() => {
      void this.tick('startup');
    }, FIRST_RUN_DELAY_MS);
    first.unref?.();
    this.timer = setInterval(() => {
      void this.tick('interval');
    }, INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(reason: string) {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.accommodation.processEligibleAdmissions();
      this.logger.log(
        `Accommodation charges (${reason}): generated=${result.generated} skipped=${result.skipped} admissions=${result.admissions}`,
      );
    } catch (error) {
      this.logger.warn(
        `Accommodation charge run failed (${reason}): ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    } finally {
      this.running = false;
    }
  }
}
