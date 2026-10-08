import { Module } from '@nestjs/common';

import { AuthGuard } from '../common/auth.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  controllers: [AuthController],
  exports: [AuthGuard],
  providers: [AuthGuard, AuthService],
})
export class AuthModule {}
