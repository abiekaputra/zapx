import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { loadWorkerEnvironment } from '@zapx/config';
import {
  DatabasePool,
  DeliveryNotReadyError,
  OutboxRepository,
  type OutboxDeliveryEvent,
} from '@zapx/database';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

import { DeliveryProcessor } from '../delivery/delivery.processor.js';
import { RetryableDeliveryError } from '../delivery/retry-policy.js';
import { redisOptions } from './redis-options.js';

const queueName = 'zapx-deliveries';

@Injectable()
export class DeliveryRuntime implements OnModuleInit, OnModuleDestroy {
  private readonly environment = loadWorkerEnvironment();
  private readonly logger = new Logger(DeliveryRuntime.name);
  private queue?: Queue<OutboxDeliveryEvent>;
  private queueConnection?: Redis;
  private relayTimer?: NodeJS.Timeout;
  private worker?: Worker<OutboxDeliveryEvent>;
  private workerConnection?: Redis;

  public constructor(
    @Inject(OutboxRepository) private readonly outbox: OutboxRepository,
    @Inject(DeliveryProcessor) private readonly processor: DeliveryProcessor,
    @Inject(DatabasePool) private readonly database: DatabasePool,
  ) {}

  public async onModuleInit(): Promise<void> {
    const connectionOptions = redisOptions(this.environment.REDIS_URL);
    this.queueConnection = new Redis(connectionOptions);
    this.workerConnection = new Redis(connectionOptions);
    this.queue = new Queue(queueName, { connection: this.queueConnection });
    this.worker = new Worker(
      queueName,
      async (job) => this.processor.process(job.data.notificationId),
      {
        concurrency: this.environment.WORKER_CONCURRENCY,
        connection: this.workerConnection,
        settings: {
          backoffStrategy: (_attempts, _type, error) =>
            error instanceof RetryableDeliveryError
              ? error.delayMs
              : error instanceof DeliveryNotReadyError
                ? 250
                : 5_000,
        },
      },
    );
    this.worker.on('error', (error) => this.logger.error(error.message));
    await this.relay();
    this.relayTimer = setInterval(() => void this.safeRelay(), 1_000);
  }

  public async onModuleDestroy(): Promise<void> {
    if (this.relayTimer) clearInterval(this.relayTimer);
    await this.worker?.close();
    await this.queue?.close();
    await this.database.close();
  }

  public async isReady(): Promise<boolean> {
    if (!this.queue) return false;
    try {
      await this.queue.getJobCounts('wait');
      return this.database.isReady();
    } catch {
      return false;
    }
  }

  private async relay(): Promise<void> {
    await this.outbox.publishPending(async (event) => {
      await this.queue!.add('deliver', event, {
        attempts: 6,
        backoff: { type: 'zapx' },
        jobId: event.eventId,
        removeOnComplete: { age: 86_400, count: 10_000 },
        removeOnFail: false,
      });
    });
  }

  private async safeRelay(): Promise<void> {
    try {
      await this.relay();
    } catch (error) {
      this.logger.warn(error instanceof Error ? error.message : 'Outbox relay failed.');
    }
  }
}
