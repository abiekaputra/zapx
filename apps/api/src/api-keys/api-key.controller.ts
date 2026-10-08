import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { createApiKeySchema } from '@zapx/domain';
import type { Principal } from '@zapx/domain';

import { AuthGuard } from '../common/auth.guard.js';
import { CurrentPrincipal } from '../common/current-principal.decorator.js';
import { ApiKeyService } from './api-key.service.js';

@Controller('v1/api-keys')
@UseGuards(AuthGuard)
export class ApiKeyController {
  public constructor(@Inject(ApiKeyService) private readonly apiKeys: ApiKeyService) {}

  @Get()
  public list(@CurrentPrincipal() principal: Principal) {
    return this.apiKeys.list(principal);
  }

  @Post()
  public create(@CurrentPrincipal() principal: Principal, @Body() body: unknown) {
    const input = createApiKeySchema.parse(body);
    return this.apiKeys.create(principal, {
      expiresAt: input.expires_at ? new Date(input.expires_at) : null,
      name: input.name,
      scopes: input.scopes,
    });
  }

  @Post(':id/revoke')
  public revoke(@CurrentPrincipal() principal: Principal, @Param('id') id: string) {
    return this.apiKeys.revoke(principal, id);
  }
}
