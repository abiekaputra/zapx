import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { ApiKeyController } from './api-key.controller.js';
import { ApiKeyService } from './api-key.service.js';

@Module({
  controllers: [ApiKeyController],
  imports: [AuthModule],
  providers: [ApiKeyService],
})
export class ApiKeyModule {}
