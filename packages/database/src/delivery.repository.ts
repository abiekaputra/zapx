import type { PoolClient, QueryResultRow } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import type { ClaimedDelivery, DeliveryCompletion, ReplayRequest } from './delivery.types.js';
import type { DatabasePool } from './pool.js';

interface DeliveryRow extends QueryResultRow {
  attempt_count: number;
  body_ciphertext: string;
  body_nonce: string;
  body_tag: string;
  channel: 'EMAIL' | 'WEBHOOK';
  config_ciphertext: string | null;
  config_nonce: string | null;
  config_tag: string | null;
  delivery_cycle_attempt: number;
  id: string;
  provider_connection_id: string;
  recipient_ciphertext: string;
  recipient_nonce: string;
  recipient_tag: string;
  status: string;
  subject_ciphertext: string | null;
  subject_nonce: string | null;
  subject_tag: string | null;
  trace_id: string;
  workspace_id: string;
}

export class DeliveryRepository {
  public constructor(private readonly database: DatabasePool) {}

  public async claim(notificationId: string): Promise<ClaimedDelivery | null> {
    return this.database.transaction(async (client) => {
      const result = await client.query<DeliveryRow>(
        `SELECT n.*, p.config_ciphertext, p.config_nonce, p.config_tag
         FROM notifications n
         JOIN provider_connections p ON p.id = n.provider_connection_id
         WHERE n.id = $1
         FOR UPDATE OF n`,
        [notificationId],
      );
      const row = result.rows[0];
      if (row?.status === 'ACCEPTED') throw new DeliveryNotReadyError();
      if (row?.status === 'PROCESSING') {
        await this.markStalled(client, row);
        return null;
      }
      if (!row || !['QUEUED', 'RETRY_SCHEDULED'].includes(row.status)) return null;

      const attemptId = uuidv7();
      const attemptNumber = row.attempt_count + 1;
      const cycleAttempt = row.delivery_cycle_attempt + 1;
      await client.query(
        `INSERT INTO delivery_attempts(
           id, notification_id, attempt_number, started_at, trace_id
         ) VALUES ($1, $2, $3, now(), $4)`,
        [attemptId, row.id, attemptNumber, row.trace_id],
      );
      await client.query(
        `UPDATE notifications
         SET status = 'PROCESSING', attempt_count = $2, delivery_cycle_attempt = $3,
             next_attempt_at = NULL,
             updated_at = now(), version = version + 1
         WHERE id = $1`,
        [row.id, attemptNumber, cycleAttempt],
      );
      return this.mapClaim(row, attemptId, attemptNumber, cycleAttempt);
    });
  }

  public async complete(completion: DeliveryCompletion): Promise<void> {
    await this.database.transaction(async (client) => {
      await client.query(
        `UPDATE delivery_attempts
         SET outcome = $2, error_code = $3, error_summary = $4,
             provider_request_id = $5, finished_at = now(), duration_ms = $6
         WHERE id = $1 AND outcome IS NULL`,
        [
          completion.attemptId,
          completion.outcome,
          completion.errorCode,
          completion.errorSummary?.slice(0, 500) ?? null,
          completion.providerRequestId,
          completion.durationMs,
        ],
      );
      const status = this.nextStatus(completion);
      await client.query(
        `UPDATE notifications
         SET status = $2, next_attempt_at = $3, last_error_code = $4,
             terminal_at = CASE WHEN $2 IN ('DELIVERED', 'DEAD_LETTER') THEN now() ELSE NULL END,
             updated_at = now(), version = version + 1
         WHERE id = $1 AND status = 'PROCESSING'`,
        [completion.notificationId, status, completion.nextAttemptAt, completion.errorCode],
      );
    });
  }

  public async replay(input: ReplayRequest): Promise<boolean> {
    return this.database.transaction(async (client) => {
      const selected = await client.query(
        `SELECT 1 FROM notifications
         WHERE id = $1 AND workspace_id = $2 AND status = 'DEAD_LETTER'
         FOR UPDATE`,
        [input.notificationId, input.workspaceId],
      );
      if (!selected.rowCount) return false;
      await client.query(
        `UPDATE notifications
         SET status = 'ACCEPTED', delivery_cycle_attempt = 0, next_attempt_at = NULL,
             last_error_code = NULL, terminal_at = NULL, trace_id = $3,
             updated_at = now(), version = version + 1
         WHERE id = $1 AND workspace_id = $2`,
        [input.notificationId, input.workspaceId, input.traceId],
      );
      await client.query(
        `INSERT INTO outbox_events(
           id, aggregate_type, aggregate_id, event_type, schema_version, payload, occurred_at
         ) VALUES ($1, 'NOTIFICATION', $2, 'notification.replayed', 1, $3, now())`,
        [
          uuidv7(),
          input.notificationId,
          {
            notification_id: input.notificationId,
            trace_id: input.traceId,
            workspace_id: input.workspaceId,
          },
        ],
      );
      await this.insertReplayAudit(client, input);
      return true;
    });
  }

  private nextStatus(completion: DeliveryCompletion): string {
    if (completion.outcome === 'SUCCEEDED') return 'DELIVERED';
    return completion.nextAttemptAt ? 'RETRY_SCHEDULED' : 'DEAD_LETTER';
  }

  private mapClaim(
    row: DeliveryRow,
    attemptId: string,
    attemptNumber: number,
    cycleAttempt: number,
  ): ClaimedDelivery {
    return {
      attemptId,
      attemptNumber,
      body: this.encrypted(row.body_ciphertext, row.body_nonce, row.body_tag),
      channel: row.channel,
      cycleAttempt,
      notificationId: row.id,
      providerConfig:
        row.config_ciphertext && row.config_nonce && row.config_tag
          ? this.encrypted(row.config_ciphertext, row.config_nonce, row.config_tag)
          : null,
      providerConnectionId: row.provider_connection_id,
      recipient: this.encrypted(row.recipient_ciphertext, row.recipient_nonce, row.recipient_tag),
      subject: row.subject_ciphertext
        ? this.encrypted(row.subject_ciphertext, row.subject_nonce!, row.subject_tag!)
        : null,
      traceId: row.trace_id,
      workspaceId: row.workspace_id,
    };
  }

  private encrypted(ciphertext: string, nonce: string, tag: string) {
    return { ciphertext, nonce, tag };
  }

  private async markStalled(client: PoolClient, row: DeliveryRow): Promise<void> {
    await client.query(
      `UPDATE delivery_attempts
       SET outcome = 'INDETERMINATE', error_code = 'WORKER_STALLED',
           error_summary = 'Worker lock expired before the provider outcome was committed.',
           finished_at = now(), duration_ms = 0
       WHERE notification_id = $1 AND outcome IS NULL`,
      [row.id],
    );
    await client.query(
      `UPDATE notifications
       SET status = 'DEAD_LETTER', last_error_code = 'WORKER_STALLED',
           terminal_at = now(), updated_at = now(), version = version + 1
       WHERE id = $1 AND status = 'PROCESSING'`,
      [row.id],
    );
  }

  private async insertReplayAudit(client: PoolClient, input: ReplayRequest): Promise<void> {
    await client.query(
      `INSERT INTO audit_events(
         id, workspace_id, actor_type, actor_label, actor_id, action,
         target_type, target_id, metadata, occurred_at, trace_id
       ) VALUES ($1, $2, $3, $4, $5, 'notification.replayed',
                 'NOTIFICATION', $6, '{}', now(), $7)`,
      [
        uuidv7(),
        input.workspaceId,
        input.actorType,
        input.actorLabel,
        input.actorId,
        input.notificationId,
        input.traceId,
      ],
    );
  }
}

export class DeliveryNotReadyError extends Error {}
