import type { QueryResultRow } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import type { DatabasePool } from './pool.js';

interface TemplateListRow extends QueryResultRow {
  body_template: string | null;
  channel: 'EMAIL' | 'WEBHOOK';
  created_at: Date;
  id: string;
  name: string;
  published_at: Date | null;
  required_variables: string[] | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  subject_template: string | null;
  version_id: string | null;
  version_number: number | null;
}

interface VersionRow extends QueryResultRow {
  body_template: string;
  channel: 'EMAIL' | 'WEBHOOK';
  id: string;
  published_at: Date | null;
  required_variables: string[];
  subject_template: string | null;
  template_id: string;
  version_number: number;
}

export class TemplateRepository {
  public constructor(private readonly database: DatabasePool) {}

  public async list(workspaceId: string): Promise<TemplateListRow[]> {
    const result = await this.database.pool.query<TemplateListRow>(
      `SELECT t.id, t.name, t.channel, t.status, t.created_at,
              tv.id AS version_id, tv.version_number, tv.subject_template,
              tv.body_template, tv.required_variables, tv.published_at
       FROM templates t
       LEFT JOIN LATERAL (
         SELECT * FROM template_versions v WHERE v.template_id = t.id
         ORDER BY v.version_number DESC LIMIT 1
       ) tv ON true
       WHERE t.workspace_id = $1
       ORDER BY t.created_at ASC, t.id ASC`,
      [workspaceId],
    );
    return result.rows;
  }

  public async create(input: {
    channel: 'EMAIL' | 'WEBHOOK';
    name: string;
    userId: string;
    workspaceId: string;
  }): Promise<{ id: string }> {
    const id = uuidv7();
    await this.database.pool.query(
      `INSERT INTO templates(id, workspace_id, name, channel, status)
       VALUES ($1, $2, $3, $4, 'DRAFT')`,
      [id, input.workspaceId, input.name, input.channel],
    );
    return { id };
  }

  public async createVersion(input: {
    body: string;
    subject: string | null;
    templateId: string;
    userId: string;
    variables: string[];
    workspaceId: string;
  }): Promise<VersionRow | null> {
    return this.database.transaction(async (client) => {
      const template = await client.query<{ channel: 'EMAIL' | 'WEBHOOK' }>(
        `SELECT channel FROM templates
         WHERE id = $1 AND workspace_id = $2 AND status <> 'ARCHIVED'
         FOR UPDATE`,
        [input.templateId, input.workspaceId],
      );
      if (!template.rows[0]) return null;
      const result = await client.query<VersionRow>(
        `INSERT INTO template_versions(
           id, template_id, version_number, subject_template, body_template,
           required_variables, creator_user_id
         ) VALUES (
           $1, $2,
           COALESCE((SELECT max(version_number) + 1 FROM template_versions WHERE template_id = $2), 1),
           $3, $4, $5, $6
         ) RETURNING *, $7::text AS channel`,
        [
          uuidv7(),
          input.templateId,
          input.subject,
          input.body,
          input.variables,
          input.userId,
          template.rows[0].channel,
        ],
      );
      return result.rows[0]!;
    });
  }

  public async findVersion(workspaceId: string, id: string): Promise<VersionRow | null> {
    const result = await this.database.pool.query<VersionRow>(
      `SELECT tv.*, t.channel
       FROM template_versions tv JOIN templates t ON t.id = tv.template_id
       WHERE tv.id = $2 AND t.workspace_id = $1`,
      [workspaceId, id],
    );
    return result.rows[0] ?? null;
  }

  public async publish(workspaceId: string, id: string): Promise<VersionRow | null> {
    return this.database.transaction(async (client) => {
      const result = await client.query<VersionRow>(
        `UPDATE template_versions tv SET published_at = COALESCE(tv.published_at, now())
         FROM templates t
         WHERE tv.id = $2 AND t.id = tv.template_id AND t.workspace_id = $1
         RETURNING tv.*, t.channel`,
        [workspaceId, id],
      );
      const row = result.rows[0];
      if (!row) return null;
      await client.query(
        "UPDATE templates SET status = 'ACTIVE', updated_at = now() WHERE id = $1",
        [row.template_id],
      );
      return row;
    });
  }
}
