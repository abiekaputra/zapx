import type { PoolClient, QueryResultRow } from 'pg';

import type { OutboxDeliveryEvent } from './delivery.types.js';
import type { DatabasePool } from './pool.js';

interface OutboxRow extends QueryResultRow {
  aggregate_id: string;
  id: string;
  payload: { trace_id: string; workspace_id: string };
}

export class OutboxRepository {
  public constructor(private readonly database: DatabasePool) {}

  public async publishPending(
    publish: (event: OutboxDeliveryEvent) => Promise<void>,
    limit = 25,
  ): Promise<number> {
    return this.database.transaction(async (client) => {
      const events = await this.lockPending(client, limit);
      let published = 0;
      for (const event of events) {
        const delivery = this.toDeliveryEvent(event);
        try {
          await publish(delivery);
          await this.markPublished(client, delivery);
          published += 1;
        } catch (error) {
          await this.markFailure(client, event.id, error);
          break;
        }
      }
      return published;
    });
  }

  private async lockPending(client: PoolClient, limit: number): Promise<OutboxRow[]> {
    const result = await client.query<OutboxRow>(
      `SELECT id, aggregate_id, payload
       FROM outbox_events
       WHERE published_at IS NULL
         AND event_type IN ('notification.accepted', 'notification.replayed')
       ORDER BY occurred_at, id
       FOR UPDATE SKIP LOCKED
       LIMIT $1`,
      [limit],
    );
    return result.rows;
  }

  private async markPublished(client: PoolClient, event: OutboxDeliveryEvent): Promise<void> {
    await client.query(
      `UPDATE outbox_events
       SET published_at = now(), publish_attempts = publish_attempts + 1,
           last_publish_error = NULL
       WHERE id = $1`,
      [event.eventId],
    );
    await client.query(
      `UPDATE notifications
       SET status = 'QUEUED', updated_at = now(), version = version + 1
       WHERE id = $1 AND status = 'ACCEPTED'`,
      [event.notificationId],
    );
  }

  private async markFailure(client: PoolClient, id: string, error: unknown): Promise<void> {
    const summary = error instanceof Error ? error.message : 'Queue publication failed';
    await client.query(
      `UPDATE outbox_events
       SET publish_attempts = publish_attempts + 1, last_publish_error = $2
       WHERE id = $1`,
      [id, summary.slice(0, 200)],
    );
  }

  private toDeliveryEvent(row: OutboxRow): OutboxDeliveryEvent {
    return {
      eventId: row.id,
      notificationId: row.aggregate_id,
      traceId: row.payload.trace_id,
      workspaceId: row.payload.workspace_id,
    };
  }
}
