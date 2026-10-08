import { Inject, Injectable } from '@nestjs/common';
import { loadApiEnvironment } from '@zapx/config';
import { AuditRepository, ProviderRepository, type ProviderRecord } from '@zapx/database';
import {
  DomainError,
  type CreateProvider,
  type Principal,
  type ProviderConfig,
} from '@zapx/domain';
import { PayloadCipher } from '@zapx/security';
import { randomBytes } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';

import { testProvider } from './provider-tester.js';

@Injectable()
export class ProviderService {
  private readonly environment = loadApiEnvironment();
  private readonly cipher = PayloadCipher.fromBase64(this.environment.ZAPX_MASTER_KEY);
  private readonly allowedHosts = new Set(
    this.environment.WEBHOOK_ALLOWED_HOSTS.split(',').map((host) => host.trim().toLowerCase()),
  );

  public constructor(
    @Inject(ProviderRepository) private readonly providers: ProviderRepository,
    @Inject(AuditRepository) private readonly audit: AuditRepository,
  ) {}

  public async list(principal: Principal) {
    if (principal.kind !== 'USER') {
      throw new DomainError('FORBIDDEN', 'Browser session is required', 403);
    }
    return Promise.all(
      (await this.providers.list(principal.workspaceId)).map((item) => this.view(item)),
    );
  }

  public async create(principal: Principal, input: CreateProvider) {
    this.requireOwner(principal);
    const providerId = uuidv7();
    const encrypted = this.cipher.encrypt(
      JSON.stringify(input.config),
      `${principal.workspaceId}:${providerId}:config`,
    );
    const provider = await this.providers.create({
      config: encrypted,
      id: providerId,
      kind: input.kind,
      name: input.name,
      workspaceId: principal.workspaceId,
    });
    await this.record(principal, 'provider.created', provider.id, { kind: input.kind });
    return this.view(provider);
  }

  public async test(principal: Principal, id: string) {
    this.requireOwner(principal);
    const provider = await this.providers.find(principal.workspaceId, id);
    if (!provider?.config) throw new DomainError('NOT_FOUND', 'Provider was not found', 404);
    const config = this.decrypt(provider);
    const result = await testProvider(provider.kind, config, this.allowedHosts);
    const updated = await this.providers.recordTest(
      principal.workspaceId,
      id,
      result.successful,
      result.message,
    );
    await this.record(principal, 'provider.tested', id, { successful: result.successful });
    return { ...result, provider: await this.view(updated!) };
  }

  public async disable(principal: Principal, id: string) {
    this.requireOwner(principal);
    if (!(await this.providers.disable(principal.workspaceId, id))) {
      throw new DomainError('NOT_FOUND', 'Provider was not found', 404);
    }
    await this.record(principal, 'provider.disabled', id);
    return { status: 'DISABLED' };
  }

  private decrypt(provider: ProviderRecord): ProviderConfig {
    const value = this.cipher.decrypt(
      provider.config!,
      `${provider.workspaceId}:${provider.id}:config`,
    );
    return JSON.parse(value) as ProviderConfig;
  }

  private async view(provider: ProviderRecord) {
    const config = provider.config ? this.decrypt(provider) : null;
    return {
      config_summary: config ? this.summary(config) : null,
      created_at: provider.createdAt.toISOString(),
      id: provider.id,
      kind: provider.kind,
      last_test_result: provider.lastTestResult,
      last_tested_at: provider.lastTestedAt?.toISOString() ?? null,
      name: provider.name,
      status: provider.status,
    };
  }

  private summary(config: ProviderConfig) {
    return 'host' in config
      ? { from: config.from, host: config.host, port: config.port, secure: config.secure }
      : { url: new URL(config.url).origin, signing_secret: '••••••••' };
  }

  private requireOwner(principal: Principal): void {
    if (principal.kind !== 'USER' || principal.role !== 'OWNER') {
      throw new DomainError('FORBIDDEN', 'Owner permission is required', 403);
    }
  }

  private async record(
    principal: Principal,
    action: string,
    targetId: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.audit.record({
      action,
      actorId: principal.actorId,
      actorLabel: principal.actorLabel,
      actorType: principal.kind,
      ...(metadata ? { metadata } : {}),
      targetId,
      targetType: 'PROVIDER',
      traceId: randomBytes(16).toString('hex'),
      workspaceId: principal.workspaceId,
    });
  }
}
