import { Module } from '@nestjs/common';
import { loadWorkerEnvironment } from '@zapx/config';
import {
  DatabasePool,
  DeliveryRepository,
  OutboxRepository,
  RetentionRepository,
} from '@zapx/database';

import { DeliveryProcessor } from './delivery/delivery.processor.js';
import { ProviderRateLimiter } from './delivery/provider-rate-limiter.js';
import { HealthController } from './health/health.controller.js';
import { DeliveryRuntime } from './runtime/delivery.runtime.js';
import { RetentionRuntime } from './runtime/retention.runtime.js';

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: DatabasePool,
      useFactory: () => new DatabasePool(loadWorkerEnvironment().DATABASE_URL),
    },
    {
      provide: DeliveryRepository,
      useFactory: (database: DatabasePool) => new DeliveryRepository(database),
      inject: [DatabasePool],
    },
    {
      provide: OutboxRepository,
      useFactory: (database: DatabasePool) => new OutboxRepository(database),
      inject: [DatabasePool],
    },
    {
      provide: RetentionRepository,
      useFactory: (database: DatabasePool) => new RetentionRepository(database),
      inject: [DatabasePool],
    },
    DeliveryProcessor,
    ProviderRateLimiter,
    DeliveryRuntime,
    RetentionRuntime,
  ],
})
export class AppModule {}
