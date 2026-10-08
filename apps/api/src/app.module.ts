import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { ApiKeyModule } from './api-keys/api-key.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';
import { NotificationModule } from './notifications/notification.module.js';
import { OperationsModule } from './operations/operations.module.js';
import { ProviderModule } from './providers/provider.module.js';
import { TemplateModule } from './templates/template.module.js';
import { RateLimitGuard } from './common/rate-limit.guard.js';

@Module({
  controllers: [HealthController],
  imports: [
    DatabaseModule,
    AuthModule,
    ApiKeyModule,
    NotificationModule,
    OperationsModule,
    ProviderModule,
    TemplateModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: RateLimitGuard }],
})
export class AppModule {}
