import { Inject, Injectable } from '@nestjs/common';
import { loadApiEnvironment } from '@zapx/config';
import {
  IdempotencyConflictError,
  NotificationRepository,
  type PreparedNotification,
} from '@zapx/database';
import {
  DomainError,
  normalizeRecipient,
  renderTemplate,
  type NotificationSubmission,
  type Principal,
} from '@zapx/domain';
import { canonicalHash, PayloadCipher, sha256 } from '@zapx/security';
import { randomBytes } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class NotificationService {
  private readonly cipher = PayloadCipher.fromBase64(loadApiEnvironment().ZAPX_MASTER_KEY);

  public constructor(
    @Inject(NotificationRepository)
    private readonly notifications: NotificationRepository,
  ) {}

  public async submit(principal: Principal, idempotencyKey: string, input: NotificationSubmission) {
    this.requireScope(principal, 'notifications:write');
    if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Idempotency-Key must contain between 8 and 200 characters',
        422,
      );
    }

    const template = await this.notifications.loadTemplate(
      principal.workspaceId,
      input.template_version_id,
      input.provider_connection_id,
    );
    if (!template) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Template or provider is unavailable for this workspace',
        422,
      );
    }

    const recipient = normalizeRecipient(template.channel, input.recipient);
    const rendered = renderTemplate(template, input.variables);
    const notificationId = uuidv7();
    const association = `${principal.workspaceId}:${notificationId}`;
    const prepared: PreparedNotification = {
      body: this.cipher.encrypt(rendered.body, `${association}:body`),
      channel: template.channel,
      creatorId: principal.actorId,
      creatorKind: principal.kind,
      idempotencyHash: sha256(idempotencyKey),
      notificationId,
      providerConnectionId: input.provider_connection_id,
      recipient: this.cipher.encrypt(recipient, `${association}:recipient`),
      recipientFingerprint: this.cipher.fingerprint(recipient),
      requestHash: canonicalHash({
        ...input,
        recipient,
      }),
      subject: rendered.subject
        ? this.cipher.encrypt(rendered.subject, `${association}:subject`)
        : null,
      templateVersionId: input.template_version_id,
      traceId: randomBytes(16).toString('hex'),
      workspaceId: principal.workspaceId,
    };

    try {
      return await this.notifications.submit(prepared);
    } catch (error) {
      if (error instanceof IdempotencyConflictError) {
        throw new DomainError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency-Key was already used with a different request',
          409,
        );
      }
      throw error;
    }
  }

  public async list(principal: Principal, limit: number) {
    this.requireScope(principal, 'notifications:read');
    return (await this.notifications.list(principal.workspaceId, limit)).map((row) => ({
      accepted_at: row.accepted_at.toISOString(),
      channel: row.channel,
      created_at: row.created_at.toISOString(),
      id: row.id,
      provider_connection_id: row.provider_connection_id,
      status: row.status,
      template_version_id: row.template_version_id,
    }));
  }

  private requireScope(principal: Principal, scope: string): void {
    if (principal.role === 'VIEWER' || !principal.scopes.includes(scope)) {
      throw new DomainError('FORBIDDEN', 'The credential lacks the required scope', 403);
    }
  }
}
