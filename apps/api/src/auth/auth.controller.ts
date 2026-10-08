import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { loginSchema, refreshSchema } from '@zapx/domain';
import type { Principal } from '@zapx/domain';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AuthGuard } from '../common/auth.guard.js';
import { CurrentPrincipal } from '../common/current-principal.decorator.js';
import { AuthService, type IssuedSession } from './auth.service.js';
import { clearSessionCookies, setSessionCookies } from './session-cookies.js';

@Controller('v1/auth')
export class AuthController {
  public constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  public async login(@Body() body: unknown, @Res({ passthrough: true }) reply: FastifyReply) {
    const input = loginSchema.parse(body);
    const session = await this.auth.login(input.email, input.password);
    setSessionCookies(reply, session);
    return this.publicSession(session);
  }

  @Post('refresh')
  @HttpCode(200)
  public async refresh(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const input = refreshSchema.partial().parse(body ?? {});
    const session = await this.auth.refresh(
      input.refresh_token ?? request.cookies.zapx_refresh ?? '',
    );
    setSessionCookies(reply, session);
    return this.publicSession(session);
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  public async logout(
    @Headers('authorization') authorization: string | undefined,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.auth.logout(
      authorization?.replace(/^Bearer /, '') ?? request.cookies.zapx_access ?? '',
    );
    clearSessionCookies(reply);
    return { status: 'revoked' };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  public me(@CurrentPrincipal() principal: Principal) {
    return this.auth.me(principal);
  }

  private publicSession(session: IssuedSession) {
    return {
      access_expires_at: session.accessExpiresAt.toISOString(),
      csrf_token: session.csrfToken,
      refresh_expires_at: session.refreshExpiresAt.toISOString(),
      user: session.user,
    };
  }
}
