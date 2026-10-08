import { v7 as uuidv7 } from 'uuid';

import type { DatabasePool } from './pool.js';

export class RetentionRepository {
  public constructor(private readonly database: DatabasePool) {}

  public async eraseExpiredPayloads(): Promise<number> {
    return this.database.transaction(async (client) => {
      const result = await client.query<{ count: string; workspace_id: string }>(
        `WITH erased AS (
           UPDATE notifications
           SET recipient_ciphertext = NULL, recipient_nonce = NULL, recipient_tag = NULL,
               subject_ciphertext = NULL, subject_nonce = NULL, subject_tag = NULL,
               body_ciphertext = NULL, body_nonce = NULL, body_tag = NULL,
               payload_erased_at = now(), updated_at = now()
           WHERE terminal_at < now() - interval '7 days' AND payload_erased_at IS NULL
           RETURNING workspace_id
         ) SELECT workspace_id, count(*)::text AS count FROM erased GROUP BY workspace_id`,
      );
      for (const row of result.rows) {
        await client.query(
          `INSERT INTO audit_events(
             id, workspace_id, actor_type, actor_label, actor_id, action,
             target_type, target_id, metadata, occurred_at, trace_id
           ) VALUES ($1, $2, 'SYSTEM', 'ZapX retention', NULL, 'retention.payload_erased',
                     'NOTIFICATION_BATCH', NULL, $3, now(), $4)`,
          [uuidv7(), row.workspace_id, { count: Number(row.count) }, uuidv7().replaceAll('-', '')],
        );
      }
      return result.rows.reduce((total, row) => total + Number(row.count), 0);
    });
  }
}
