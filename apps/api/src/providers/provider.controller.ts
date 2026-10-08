import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { createProviderSchema, type Principal } from '@zapx/domain';
import { z } from 'zod';

import { AuthGuard } from '../common/auth.guard.js';
import { CurrentPrincipal } from '../common/current-principal.decorator.js';
import { ProviderService } from './provider.service.js';

@Controller('v1/providers')
@UseGuards(AuthGuard)
export class ProviderController {
  public constructor(@Inject(ProviderService) private readonly providers: ProviderService) {}

  @Get()
  public list(@CurrentPrincipal() principal: Principal) {
    return this.providers.list(principal);
  }

  @Post()
  public create(@CurrentPrincipal() principal: Principal, @Body() body: unknown) {
    return this.providers.create(principal, createProviderSchema.parse(body));
  }

  @Post(':id/test')
  public test(@CurrentPrincipal() principal: Principal, @Param('id') id: string) {
    return this.providers.test(principal, z.string().uuid().parse(id));
  }

  @Post(':id/disable')
  public disable(@CurrentPrincipal() principal: Principal, @Param('id') id: string) {
    return this.providers.disable(principal, z.string().uuid().parse(id));
  }
}
