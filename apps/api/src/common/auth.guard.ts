import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ApiKeyRepository, IdentityRepository } from '@zapx/database';
import { DomainError } from '@zapx/domain';
import { safeEqual, sha256 } from '@zapx/security';

import type { AuthenticatedRequest } from './authenticated-request.js';

@Injectable()
export class AuthGuard implements CanActivate {
  public constructor(
    @Inject(IdentityRepository)
    private readonly identities: IdentityRepository,
    @Inject(ApiKeyRepository)
    private readonly apiKeys: ApiKeyRepository,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const bearer = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : null;
    const token = bearer ?? request.cookies.zapx_access;
    if (!token) throw new UnauthorizedException();
    if (!bearer) this.validateCsrf(request);
    const principal = token.startsWith('zx_key_')
      ? await this.authenticateApiKey(token)
      : await this.identities.authenticateAccess(sha256(token));
    if (!principal) throw new UnauthorizedException();

    request.principal = principal;
    return true;
  }

  private async authenticateApiKey(token: string) {
    const match = /^zx_key_([a-f0-9]{12})_(.+)$/.exec(token);
    if (!match) return null;
    return this.apiKeys.authenticate(match[1]!, match[2]!);
  }

  private validateCsrf(request: AuthenticatedRequest): void {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
    const header = request.headers['x-csrf-token'];
    const cookie = request.cookies.zapx_csrf;
    if (typeof header !== 'string' || !cookie || !safeEqual(header, cookie)) {
      throw new DomainError('FORBIDDEN', 'A valid CSRF token is required', 403);
    }
  }
}
