import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import {
  createTemplateSchema,
  createTemplateVersionSchema,
  previewTemplateSchema,
  type Principal,
} from '@zapx/domain';
import { z } from 'zod';

import { AuthGuard } from '../common/auth.guard.js';
import { CurrentPrincipal } from '../common/current-principal.decorator.js';
import { TemplateService } from './template.service.js';

@Controller('v1')
@UseGuards(AuthGuard)
export class TemplateController {
  public constructor(@Inject(TemplateService) private readonly templates: TemplateService) {}

  @Get('templates')
  public list(@CurrentPrincipal() principal: Principal) {
    return this.templates.list(principal);
  }

  @Post('templates')
  public create(@CurrentPrincipal() principal: Principal, @Body() body: unknown) {
    return this.templates.create(principal, createTemplateSchema.parse(body));
  }

  @Post('templates/:id/versions')
  public createVersion(
    @CurrentPrincipal() principal: Principal,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.templates.createVersion(
      principal,
      z.string().uuid().parse(id),
      createTemplateVersionSchema.parse(body),
    );
  }

  @Post('template-versions/:id/preview')
  public preview(
    @CurrentPrincipal() principal: Principal,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = previewTemplateSchema.parse(body);
    return this.templates.preview(principal, z.string().uuid().parse(id), input.variables);
  }

  @Post('template-versions/:id/publish')
  public publish(@CurrentPrincipal() principal: Principal, @Param('id') id: string) {
    return this.templates.publish(principal, z.string().uuid().parse(id));
  }
}
