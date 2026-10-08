import { Module } from '@nestjs/common';

import { ApiKeyModule } from './api-keys/api-key.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';
import { NotificationModule } from './notifications/notification.module.js';

@Module({
  controllers: [HealthController],
  imports: [DatabaseModule, AuthModule, ApiKeyModule, NotificationModule],
})
export class AppModule {}
