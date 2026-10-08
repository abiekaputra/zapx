import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { OperationsModule } from '../operations/operations.module.js';
import { NotificationController } from './notification.controller.js';
import { NotificationService } from './notification.service.js';

@Module({
  controllers: [NotificationController],
  imports: [AuthModule, OperationsModule],
  providers: [NotificationService],
})
export class NotificationModule {}
