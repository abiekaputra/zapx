import type { EncryptedValue } from '@zapx/security';
import type { QueryResultRow } from 'pg';

import type { DatabasePool } from './pool.js';

export interface NotificationFilters {
  channel?: 'EMAIL' | 'WEBHOOK';
  createdFrom?: Date;
  createdTo?: Date;
  limit: number;
  providerId?: string;
  status?: string;
}

interface NotificationListRow extends QueryResultRow {
  accepted_at: Date;
  attempt_count: number;
  channel: 'EMAIL' | 'WEBHOOK';
  created_at: Date;
  id: string;
  last_error_code: string | null;
  provider_name: string;
  status: string;
  template_name: string;
  trace_id: string;
}

interface NotificationDetailRow extends NotificationListRow {
  body_ciphertext: string | null;
  body_nonce: string | null;
  body_tag: string | null;
  next_attempt_at: Date | null;
  payload_erased_at: Date | null;
  recipient_ciphertext: string | null;
  recipient_nonce: string | null;
  recipient_tag: string | null;
  subject_ciphertext: string | null;
  subject_nonce: string | null;
  subject_tag: string | null;
  terminal_at: Date | null;
  workspace_id: string;
}

export interface NotificationDetailRecord extends NotificationDetailRow {
  attempts: QueryResultRow[];
  body: EncryptedValue | null;
  recipient: EncryptedValue | null;
  subject: EncryptedValue | null;
}

export class ConsoleRepository {
  public constructor(private readonly database: DatabasePool) {}

  public async listNotifications(
    workspaceId: string,
    filters: NotificationFilters,
  ): Promise<NotificationListRow[]> {
    const values: unknown[] = [workspaceId];
    const where = ['n.workspace_id = $1'];
    const add = (clause: string, value: unknown) => {
      values.push(value);
      where.push(clause.replace('?', `$${values.length}`));
    };
    if (filters.status) add('n.status = ?', filters.status);
    if (filters.channel) add('n.channel = ?', filters.channel);
    if (filters.providerId) add('n.provider_connection_id = ?', filters.providerId);
    if (filters.createdFrom) add('n.created_at >= ?', filters.createdFrom);
    if (filters.createdTo) add('n.created_at <= ?', filters.createdTo);
    values.push(filters.limit);
    const result = await this.database.pool.query<NotificationListRow>(
      `SELECT n.id, n.channel, n.status, n.attempt_count, n.accepted_at, n.created_at,
              n.last_error_code, n.trace_id, p.name AS provider_name, t.name AS template_name
       FROM notifications n
       JOIN provider_connections p ON p.id = n.provider_connection_id
       JOIN template_versions tv ON tv.id = n.template_version_id
       JOIN templates t ON t.id = tv.template_id
       WHERE ${where.join(' AND ')}
       ORDER BY n.created_at DESC, n.id DESC LIMIT $${values.length}`,
      values,
    );
    return result.rows;
  }

  public async notificationDetail(
    workspaceId: string,
    notificationId: string,
  ): Promise<NotificationDetailRecord | null> {
    const notification = await this.database.pool.query<NotificationDetailRow>(
      `SELECT n.*, p.name AS provider_name, t.name AS template_name
       FROM notifications n
       JOIN provider_connections p ON p.id = n.provider_connection_id
       JOIN template_versions tv ON tv.id = n.template_version_id
       JOIN templates t ON t.id = tv.template_id
       WHERE n.workspace_id = $1 AND n.id = $2`,
      [workspaceId, notificationId],
    );
    const row = notification.rows[0];
    if (!row) return null;
    const attempts = await this.database.pool.query(
      `SELECT id, attempt_number, outcome, error_code, error_summary,
              provider_request_id, started_at, finished_at, duration_ms, trace_id
       FROM delivery_attempts WHERE notification_id = $1 ORDER BY attempt_number ASC`,
      [notificationId],
    );
    return {
      ...row,
      attempts: attempts.rows,
      body:
        row.body_ciphertext && row.body_nonce && row.body_tag
          ? { ciphertext: row.body_ciphertext, nonce: row.body_nonce, tag: row.body_tag }
          : null,
      recipient:
        row.recipient_ciphertext && row.recipient_nonce && row.recipient_tag
          ? {
              ciphertext: row.recipient_ciphertext,
              nonce: row.recipient_nonce,
              tag: row.recipient_tag,
            }
          : null,
      subject:
        row.subject_ciphertext && row.subject_nonce && row.subject_tag
          ? {
              ciphertext: row.subject_ciphertext,
              nonce: row.subject_nonce,
              tag: row.subject_tag,
            }
          : null,
    };
  }

  public async overview(workspaceId: string): Promise<{
    counts: Record<string, number>;
    recentFailures: NotificationListRow[];
  }> {
    const [counts, recentFailures] = await Promise.all([
      this.database.pool.query<{ count: string; status: string }>(
        `SELECT status, count(*)::text AS count FROM notifications
         WHERE workspace_id = $1 GROUP BY status`,
        [workspaceId],
      ),
      this.database.pool.query<NotificationListRow>(
        `SELECT n.id, n.channel, n.status, n.attempt_count, n.accepted_at, n.created_at,
                n.last_error_code, n.trace_id, p.name AS provider_name, t.name AS template_name
         FROM notifications n
         JOIN provider_connections p ON p.id = n.provider_connection_id
         JOIN template_versions tv ON tv.id = n.template_version_id
         JOIN templates t ON t.id = tv.template_id
         WHERE n.workspace_id = $1 AND n.status IN ('RETRY_SCHEDULED', 'DEAD_LETTER')
         ORDER BY n.created_at DESC LIMIT 5`,
        [workspaceId],
      ),
    ]);
    return {
      counts: Object.fromEntries(counts.rows.map((row) => [row.status, Number(row.count)])),
      recentFailures: recentFailures.rows,
    };
  }

  public async metricSnapshot(): Promise<{
    attempts: Record<string, number>;
    averageDeliveryMs: number;
    averageQueueWaitMs: number;
    statuses: Record<string, number>;
  }> {
    const [statuses, attempts, timing] = await Promise.all([
      this.database.pool.query<{ count: string; status: string }>(
        'SELECT status, count(*)::text AS count FROM notifications GROUP BY status',
      ),
      this.database.pool.query<{ count: string; outcome: string }>(
        `SELECT COALESCE(outcome, 'IN_PROGRESS') AS outcome, count(*)::text AS count
         FROM delivery_attempts GROUP BY outcome`,
      ),
      this.database.pool.query<{ delivery_ms: string | null; queue_ms: string | null }>(
        `SELECT
           avg(da.duration_ms)::text AS delivery_ms,
           avg(extract(epoch FROM (first_attempt.started_at - n.accepted_at)) * 1000)::text AS queue_ms
         FROM notifications n
         LEFT JOIN LATERAL (
           SELECT started_at FROM delivery_attempts d
           WHERE d.notification_id = n.id ORDER BY attempt_number LIMIT 1
         ) first_attempt ON true
         LEFT JOIN delivery_attempts da ON da.notification_id = n.id`,
      ),
    ]);
    return {
      attempts: Object.fromEntries(attempts.rows.map((row) => [row.outcome, Number(row.count)])),
      averageDeliveryMs: Number(timing.rows[0]?.delivery_ms ?? 0),
      averageQueueWaitMs: Number(timing.rows[0]?.queue_ms ?? 0),
      statuses: Object.fromEntries(statuses.rows.map((row) => [row.status, Number(row.count)])),
    };
  }
}
