import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { notificationSubmissionSchema } from '@zapx/domain';
import type { Principal } from '@zapx/domain';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';

import { AuthGuard } from '../common/auth.guard.js';
import { CurrentPrincipal } from '../common/current-principal.decorator.js';
import { NotificationService } from './notification.service.js';

@Controller('v1/notifications')
@UseGuards(AuthGuard)
export class NotificationController {
  public constructor(
    @Inject(NotificationService)
    private readonly notifications: NotificationService,
  ) {}

  @Post()
  @HttpCode(202)
  public async submit(
    @CurrentPrincipal() principal: Principal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    const input = notificationSubmissionSchema.parse(body);
    const result = await this.notifications.submit(principal, idempotencyKey ?? '', input);
    if (result.replayed) response.header('Idempotency-Replayed', 'true');
    return {
      ...result.response,
    };
  }

  @Get()
  public list(@CurrentPrincipal() principal: Principal, @Query('limit') rawLimit?: string) {
    const limit = z.coerce.number().int().min(1).max(100).default(25).parse(rawLimit);
    return this.notifications.list(principal, limit);
  }

  @Post(':id/replay')
  @HttpCode(202)
  public replay(@CurrentPrincipal() principal: Principal, @Param('id') id: string) {
    return this.notifications.replay(principal, z.string().uuid().parse(id));
  }
}
