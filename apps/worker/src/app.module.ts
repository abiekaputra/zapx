import { Module } from '@nestjs/common';
import { loadWorkerEnvironment } from '@zapx/config';
import { DatabasePool, DeliveryRepository, OutboxRepository } from '@zapx/database';

import { DeliveryProcessor } from './delivery/delivery.processor.js';
import { HealthController } from './health/health.controller.js';
import { DeliveryRuntime } from './runtime/delivery.runtime.js';

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: DatabasePool,
      useFactory: () => new DatabasePool(loadWorkerEnvironment().DATABASE_URL),
    },
    DeliveryRepository,
    OutboxRepository,
    DeliveryProcessor,
    DeliveryRuntime,
  ],
})
export class AppModule {}
