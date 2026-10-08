import { v7 as uuidv7 } from 'uuid';

import type { DatabasePool } from './pool.js';

export class AuditRepository {
  public constructor(private readonly database: DatabasePool) {}

  public async record(input: {
    action: string;
    actorId: string | null;
    actorLabel: string;
    actorType: string;
    metadata?: Record<string, unknown>;
    targetId: string | null;
    targetType: string;
    traceId: string;
    workspaceId: string;
  }): Promise<void> {
    await this.database.pool.query(
      `INSERT INTO audit_events(
         id, workspace_id, actor_type, actor_label, actor_id, action,
         target_type, target_id, metadata, occurred_at, trace_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10)`,
      [
        uuidv7(),
        input.workspaceId,
        input.actorType,
        input.actorLabel,
        input.actorId,
        input.action,
        input.targetType,
        input.targetId,
        input.metadata ?? {},
        input.traceId,
      ],
    );
  }
}
