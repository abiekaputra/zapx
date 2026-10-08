import { Inject, Injectable } from '@nestjs/common';
import { AuditRepository, IdentityRepository, type LoginIdentity } from '@zapx/database';
import { DomainError, type Principal } from '@zapx/domain';
import { hashSecret, randomToken, sha256, verifySecret } from '@zapx/security';
import { randomBytes } from 'node:crypto';

export interface IssuedSession {
  accessExpiresAt: Date;
  accessToken: string;
  csrfToken: string;
  refreshExpiresAt: Date;
  refreshToken: string;
  user: {
    display_name: string;
    email: string;
    role: string;
    workspace_id: string;
  };
}

@Injectable()
export class AuthService {
  private readonly dummyHash = hashSecret(randomToken('zx_dummy_'));

  public constructor(
    @Inject(IdentityRepository)
    private readonly identities: IdentityRepository,
    @Inject(AuditRepository)
    private readonly audit: AuditRepository,
  ) {}

  public async login(email: string, password: string): Promise<IssuedSession> {
    const identity = await this.identities.findLoginIdentity(email);
    const passwordHash = identity?.passwordHash ?? (await this.dummyHash);
    const valid = await verifySecret(passwordHash, password);
    if (!identity || !valid) {
      throw new DomainError('AUTHENTICATION_FAILED', 'The email or password is incorrect', 401);
    }

    const session = this.issueTokens(identity);
    const sessionId = await this.identities.createSession(identity, session.hashes);
    await this.audit.record({
      action: 'auth.login',
      actorId: identity.userId,
      actorLabel: identity.email,
      actorType: 'USER',
      targetId: sessionId,
      targetType: 'SESSION',
      traceId: randomBytes(16).toString('hex'),
      workspaceId: identity.workspaceId,
    });
    return session.issued;
  }

  public async refresh(refreshToken: string): Promise<IssuedSession> {
    const placeholder: LoginIdentity = {
      displayName: '',
      email: '',
      passwordHash: '',
      role: 'VIEWER',
      userId: '',
      workspaceId: '',
    };
    const candidate = this.issueTokens(placeholder);
    const rotated = await this.identities.rotateSession(sha256(refreshToken), candidate.hashes);
    if (!rotated) {
      throw new DomainError('SESSION_EXPIRED', 'The session cannot be renewed', 401);
    }

    return {
      ...candidate.issued,
      user: this.userResponse(rotated.identity),
    };
  }

  public async logout(accessToken: string): Promise<void> {
    await this.identities.revokeFamily(sha256(accessToken));
  }

  public me(principal: Principal) {
    return {
      actor_id: principal.actorId,
      email: principal.actorLabel,
      kind: principal.kind,
      role: principal.role,
      scopes: principal.scopes,
      workspace_id: principal.workspaceId,
    };
  }

  private issueTokens(identity: LoginIdentity) {
    const accessToken = randomToken('zx_session_');
    const refreshToken = randomToken('zx_refresh_', 48);
    const csrfToken = randomToken('zx_csrf_', 24);
    const accessExpiresAt = new Date(Date.now() + 15 * 60 * 1_000);
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000);
    return {
      hashes: {
        accessExpiresAt,
        accessHash: sha256(accessToken),
        refreshExpiresAt,
        refreshHash: sha256(refreshToken),
      },
      issued: {
        accessExpiresAt,
        accessToken,
        csrfToken,
        refreshExpiresAt,
        refreshToken,
        user: this.userResponse(identity),
      },
    };
  }

  private userResponse(identity: LoginIdentity) {
    return {
      display_name: identity.displayName,
      email: identity.email,
      role: identity.role,
      workspace_id: identity.workspaceId,
    };
  }
}
