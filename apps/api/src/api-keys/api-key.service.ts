import { Inject, Injectable } from '@nestjs/common';
import { ApiKeyRepository, AuditRepository } from '@zapx/database';
import { DomainError, type Principal } from '@zapx/domain';
import { hashSecret, randomToken } from '@zapx/security';
import { randomBytes } from 'node:crypto';

@Injectable()
export class ApiKeyService {
  public constructor(
    @Inject(ApiKeyRepository)
    private readonly keys: ApiKeyRepository,
    @Inject(AuditRepository)
    private readonly audit: AuditRepository,
  ) {}

  public async create(
    principal: Principal,
    input: { expiresAt: Date | null; name: string; scopes: string[] },
  ) {
    this.requireOwner(principal);
    const prefix = randomBytes(6).toString('hex');
    const secret = randomToken('', 32);
    const metadata = await this.keys.create({
      creatorUserId: principal.actorId,
      expiresAt: input.expiresAt,
      name: input.name,
      prefix,
      scopes: input.scopes,
      secretHash: await hashSecret(secret),
      workspaceId: principal.workspaceId,
    });
    await this.audit.record({
      action: 'api_key.created',
      actorId: principal.actorId,
      actorLabel: principal.actorLabel,
      actorType: principal.kind,
      metadata: { name: input.name, scopes: input.scopes },
      targetId: metadata.id,
      targetType: 'API_KEY',
      traceId: randomBytes(16).toString('hex'),
      workspaceId: principal.workspaceId,
    });
    return { ...this.serialize(metadata), secret: `zx_key_${prefix}_${secret}` };
  }

  public async list(principal: Principal) {
    this.requireOwner(principal);
    return (await this.keys.list(principal.workspaceId)).map((key) => this.serialize(key));
  }

  public async revoke(principal: Principal, id: string) {
    this.requireOwner(principal);
    if (!(await this.keys.revoke(principal.workspaceId, id))) {
      throw new DomainError('NOT_FOUND', 'API key was not found', 404);
    }
    await this.audit.record({
      action: 'api_key.revoked',
      actorId: principal.actorId,
      actorLabel: principal.actorLabel,
      actorType: principal.kind,
      targetId: id,
      targetType: 'API_KEY',
      traceId: randomBytes(16).toString('hex'),
      workspaceId: principal.workspaceId,
    });
    return { status: 'revoked' };
  }

  private requireOwner(principal: Principal): void {
    if (principal.kind !== 'USER' || principal.role !== 'OWNER') {
      throw new DomainError('FORBIDDEN', 'Owner permission is required', 403);
    }
  }

  private serialize(key: {
    createdAt: Date;
    expiresAt: Date | null;
    id: string;
    lastUsedAt: Date | null;
    name: string;
    prefix: string;
    revokedAt: Date | null;
    scopes: string[];
  }) {
    return {
      created_at: key.createdAt.toISOString(),
      expires_at: key.expiresAt?.toISOString() ?? null,
      id: key.id,
      last_used_at: key.lastUsedAt?.toISOString() ?? null,
      name: key.name,
      prefix: key.prefix,
      revoked_at: key.revokedAt?.toISOString() ?? null,
      scopes: key.scopes,
    };
  }
}
