import { Body, Controller, Get, Headers, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { loginSchema, refreshSchema } from '@zapx/domain';
import type { Principal } from '@zapx/domain';

import { AuthGuard } from '../common/auth.guard.js';
import { CurrentPrincipal } from '../common/current-principal.decorator.js';
import { AuthService } from './auth.service.js';

@Controller('v1/auth')
export class AuthController {
  public constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  public login(@Body() body: unknown) {
    const input = loginSchema.parse(body);
    return this.auth.login(input.email, input.password);
  }

  @Post('refresh')
  @HttpCode(200)
  public refresh(@Body() body: unknown) {
    const input = refreshSchema.parse(body);
    return this.auth.refresh(input.refresh_token);
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  public async logout(@Headers('authorization') authorization?: string) {
    await this.auth.logout(authorization?.replace(/^Bearer /, '') ?? '');
    return { status: 'revoked' };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  public me(@CurrentPrincipal() principal: Principal) {
    return this.auth.me(principal);
  }
}
