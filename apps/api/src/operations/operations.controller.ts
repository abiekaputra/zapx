import { Controller, Get, Inject, Res, Sse, UseGuards } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import type { Principal } from '@zapx/domain';
import type { FastifyReply } from 'fastify';
import { concatMap, interval, map, type Observable, startWith } from 'rxjs';

import { AuthGuard } from '../common/auth.guard.js';
import { CurrentPrincipal } from '../common/current-principal.decorator.js';
import { OperationsService } from './operations.service.js';

@Controller()
export class OperationsController {
  public constructor(@Inject(OperationsService) private readonly operations: OperationsService) {}

  @Get('v1/overview')
  @UseGuards(AuthGuard)
  public overview(@CurrentPrincipal() principal: Principal) {
    return this.operations.overview(principal);
  }

  @Get('v1/audit-events')
  @UseGuards(AuthGuard)
  public auditEvents(@CurrentPrincipal() principal: Principal) {
    return this.operations.auditEvents(principal);
  }

  @Sse('v1/events')
  @UseGuards(AuthGuard)
  public events(@CurrentPrincipal() principal: Principal): Observable<MessageEvent> {
    return interval(2_000).pipe(
      startWith(0),
      concatMap(() => this.operations.overview(principal)),
      map((data) => ({ data, type: 'status' })),
    );
  }

  @Get('metrics')
  public async metrics(@Res() response: FastifyReply) {
    return response.type('text/plain; version=0.0.4').send(await this.operations.metrics());
  }
}
