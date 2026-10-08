import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RetentionRepository } from '@zapx/database';

@Injectable()
export class RetentionRuntime implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionRuntime.name);
  private timer?: NodeJS.Timeout;

  public constructor(
    @Inject(RetentionRepository) private readonly retention: RetentionRepository,
  ) {}

  public async onModuleInit(): Promise<void> {
    await this.run();
    this.timer = setInterval(() => void this.run(), 60 * 60 * 1_000);
  }

  public onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async run(): Promise<void> {
    try {
      const erased = await this.retention.eraseExpiredPayloads();
      if (erased > 0) this.logger.log(`Erased payloads for ${erased} expired notifications.`);
    } catch (error) {
      this.logger.warn(error instanceof Error ? error.message : 'Retention cleanup failed.');
    }
  }
}
