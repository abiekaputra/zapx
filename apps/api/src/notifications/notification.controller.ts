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
import { OperationsService } from '../operations/operations.service.js';

@Controller('v1/notifications')
@UseGuards(AuthGuard)
export class NotificationController {
  public constructor(
    @Inject(NotificationService)
    private readonly notifications: NotificationService,
    @Inject(OperationsService)
    private readonly operations: OperationsService,
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
  public list(@CurrentPrincipal() principal: Principal, @Query() query: unknown) {
    const filters = z
      .object({
        channel: z.enum(['EMAIL', 'WEBHOOK']).optional(),
        created_from: z.coerce.date().optional(),
        created_to: z.coerce.date().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(25),
        provider_connection_id: z.string().uuid().optional(),
        status: z
          .enum(['ACCEPTED', 'QUEUED', 'PROCESSING', 'DELIVERED', 'RETRY_SCHEDULED', 'DEAD_LETTER'])
          .optional(),
      })
      .parse(query);
    return this.operations.listNotifications(principal, {
      ...(filters.channel ? { channel: filters.channel } : {}),
      ...(filters.created_from ? { createdFrom: filters.created_from } : {}),
      ...(filters.created_to ? { createdTo: filters.created_to } : {}),
      limit: filters.limit,
      ...(filters.provider_connection_id ? { providerId: filters.provider_connection_id } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    });
  }

  @Get(':id')
  public detail(@CurrentPrincipal() principal: Principal, @Param('id') id: string) {
    return this.operations.notificationDetail(principal, z.string().uuid().parse(id));
  }

  @Post(':id/replay')
  @HttpCode(202)
  public replay(@CurrentPrincipal() principal: Principal, @Param('id') id: string) {
    return this.notifications.replay(principal, z.string().uuid().parse(id));
  }
}
