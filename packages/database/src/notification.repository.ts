import type { TemplateSnapshot } from '@zapx/domain';
import type { EncryptedValue } from '@zapx/security';
import type { PoolClient, QueryResultRow } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import type { DatabasePool } from './pool.js';

interface TemplateRow extends QueryResultRow {
  body_template: string;
  channel: 'EMAIL' | 'WEBHOOK';
  required_variables: string[];
  subject_template: string | null;
}

interface IdempotencyRow extends QueryResultRow {
  request_hash: string;
  response_snapshot: AcceptedNotification;
}

interface NotificationRow extends QueryResultRow {
  accepted_at: Date;
  channel: 'EMAIL' | 'WEBHOOK';
  created_at: Date;
  id: string;
  provider_connection_id: string;
  status: string;
  template_version_id: string;
}

export interface AcceptedNotification {
  id: string;
  status: 'ACCEPTED';
  status_url: string;
  trace_id: string;
}

export interface PreparedNotification {
  body: EncryptedValue;
  channel: 'EMAIL' | 'WEBHOOK';
  creatorId: string;
  creatorKind: 'USER' | 'API_KEY';
  idempotencyHash: string;
  notificationId: string;
  providerConnectionId: string;
  recipient: EncryptedValue;
  recipientFingerprint: string;
  requestHash: string;
  subject: EncryptedValue | null;
  templateVersionId: string;
  traceId: string;
  workspaceId: string;
}

export class IdempotencyConflictError extends Error {}

export class NotificationRepository {
  public constructor(private readonly database: DatabasePool) {}

  public async loadTemplate(
    workspaceId: string,
    templateVersionId: string,
    providerConnectionId: string,
  ): Promise<TemplateSnapshot | null> {
    const result = await this.database.pool.query<TemplateRow>(
      `SELECT t.channel, tv.subject_template, tv.body_template, tv.required_variables
       FROM template_versions tv
       JOIN templates t ON t.id = tv.template_id
       JOIN provider_connections p
         ON p.id = $3 AND p.workspace_id = t.workspace_id
       WHERE tv.id = $2
         AND t.workspace_id = $1
         AND tv.published_at IS NOT NULL
         AND t.status = 'ACTIVE'
         AND p.status = 'READY'
         AND ((t.channel = 'EMAIL' AND p.kind = 'SMTP') OR
              (t.channel = 'WEBHOOK' AND p.kind = 'WEBHOOK'))`,
      [workspaceId, templateVersionId, providerConnectionId],
    );
    const row = result.rows[0];
    return row
      ? {
          bodyTemplate: row.body_template,
          channel: row.channel,
          requiredVariables: row.required_variables,
          subjectTemplate: row.subject_template,
        }
      : null;
  }

  public async submit(
    prepared: PreparedNotification,
  ): Promise<{ replayed: boolean; response: AcceptedNotification }> {
    return this.database.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `${prepared.workspaceId}:${prepared.idempotencyHash}`,
      ]);
      const existing = await this.findIdempotency(client, prepared);
      if (existing) return existing;

      const notificationId = prepared.notificationId;
      const acceptedAt = new Date();
      const response: AcceptedNotification = {
        id: notificationId,
        status: 'ACCEPTED',
        status_url: `/v1/notifications/${notificationId}`,
        trace_id: prepared.traceId,
      };
      await this.insertNotification(client, notificationId, acceptedAt, prepared);
      await this.insertOutbox(client, notificationId, acceptedAt, prepared);
      await this.insertIdempotency(client, notificationId, response, prepared);
      return { replayed: false, response };
    });
  }

  public async list(workspaceId: string, limit: number): Promise<NotificationRow[]> {
    const result = await this.database.pool.query<NotificationRow>(
      `SELECT id, template_version_id, provider_connection_id, channel,
              status, accepted_at, created_at
       FROM notifications
       WHERE workspace_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      [workspaceId, limit],
    );
    return result.rows;
  }

  private async findIdempotency(
    client: PoolClient,
    prepared: PreparedNotification,
  ): Promise<{ replayed: true; response: AcceptedNotification } | null> {
    const result = await client.query<IdempotencyRow>(
      `SELECT request_hash, response_snapshot
       FROM idempotency_records
       WHERE workspace_id = $1 AND operation = 'SUBMIT_NOTIFICATION'
         AND idempotency_key_hash = $2 AND expires_at > now()`,
      [prepared.workspaceId, prepared.idempotencyHash],
    );
    const row = result.rows[0];
    if (!row) return null;
    if (row.request_hash !== prepared.requestHash) throw new IdempotencyConflictError();
    return { replayed: true, response: row.response_snapshot };
  }

  private async insertNotification(
    client: PoolClient,
    id: string,
    acceptedAt: Date,
    input: PreparedNotification,
  ): Promise<void> {
    await client.query(
      `INSERT INTO notifications(
         id, workspace_id, template_version_id, provider_connection_id, channel,
         recipient_ciphertext, recipient_nonce, recipient_tag, recipient_fingerprint,
         subject_ciphertext, subject_nonce, subject_tag,
         body_ciphertext, body_nonce, body_tag, status, accepted_at, trace_id,
         created_by_type, created_by_id
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9,
         $10, $11, $12, $13, $14, $15, 'ACCEPTED', $16, $17, $18, $19
       )`,
      [
        id,
        input.workspaceId,
        input.templateVersionId,
        input.providerConnectionId,
        input.channel,
        input.recipient.ciphertext,
        input.recipient.nonce,
        input.recipient.tag,
        input.recipientFingerprint,
        input.subject?.ciphertext ?? null,
        input.subject?.nonce ?? null,
        input.subject?.tag ?? null,
        input.body.ciphertext,
        input.body.nonce,
        input.body.tag,
        acceptedAt,
        input.creatorKind,
        input.creatorId,
        input.traceId,
      ],
    );
  }

  private async insertOutbox(
    client: PoolClient,
    notificationId: string,
    occurredAt: Date,
    input: PreparedNotification,
  ): Promise<void> {
    await client.query(
      `INSERT INTO outbox_events(
         id, aggregate_type, aggregate_id, event_type, schema_version,
         payload, occurred_at
       ) VALUES ($1, 'NOTIFICATION', $2, 'notification.accepted', 1, $3, $4)`,
      [
        uuidv7(),
        notificationId,
        {
          notification_id: notificationId,
          trace_id: input.traceId,
          workspace_id: input.workspaceId,
        },
        occurredAt,
      ],
    );
  }

  private async insertIdempotency(
    client: PoolClient,
    notificationId: string,
    response: AcceptedNotification,
    input: PreparedNotification,
  ): Promise<void> {
    await client.query(
      `INSERT INTO idempotency_records(
         id, workspace_id, operation, idempotency_key_hash, request_hash,
         resource_type, resource_id, response_snapshot, expires_at
       ) VALUES ($1, $2, 'SUBMIT_NOTIFICATION', $3, $4,
                 'NOTIFICATION', $5, $6, now() + interval '24 hours')`,
      [
        uuidv7(),
        input.workspaceId,
        input.idempotencyHash,
        input.requestHash,
        notificationId,
        response,
      ],
    );
  }
}
