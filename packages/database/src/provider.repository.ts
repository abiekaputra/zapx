import type { EncryptedValue } from '@zapx/security';
import type { QueryResultRow } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import type { DatabasePool } from './pool.js';

interface ProviderRow extends QueryResultRow {
  config_ciphertext: string | null;
  config_nonce: string | null;
  config_tag: string | null;
  created_at: Date;
  id: string;
  kind: 'SMTP' | 'WEBHOOK';
  last_test_result: string | null;
  last_tested_at: Date | null;
  name: string;
  status: 'DRAFT' | 'READY' | 'DISABLED' | 'UNHEALTHY';
  updated_at: Date;
  workspace_id: string;
}

export interface ProviderRecord {
  config: EncryptedValue | null;
  createdAt: Date;
  id: string;
  kind: 'SMTP' | 'WEBHOOK';
  lastTestResult: string | null;
  lastTestedAt: Date | null;
  name: string;
  status: ProviderRow['status'];
  updatedAt: Date;
  workspaceId: string;
}

export class ProviderRepository {
  public constructor(private readonly database: DatabasePool) {}

  public async list(workspaceId: string): Promise<ProviderRecord[]> {
    const result = await this.database.pool.query<ProviderRow>(
      `SELECT * FROM provider_connections
       WHERE workspace_id = $1 ORDER BY created_at ASC, id ASC`,
      [workspaceId],
    );
    return result.rows.map((row) => this.map(row));
  }

  public async find(workspaceId: string, id: string): Promise<ProviderRecord | null> {
    const result = await this.database.pool.query<ProviderRow>(
      'SELECT * FROM provider_connections WHERE workspace_id = $1 AND id = $2',
      [workspaceId, id],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  public async create(input: {
    config: EncryptedValue;
    id?: string;
    kind: 'SMTP' | 'WEBHOOK';
    name: string;
    workspaceId: string;
  }): Promise<ProviderRecord> {
    const id = input.id ?? uuidv7();
    const result = await this.database.pool.query<ProviderRow>(
      `INSERT INTO provider_connections(
         id, workspace_id, name, kind, status,
         config_ciphertext, config_nonce, config_tag
       ) VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6, $7)
       RETURNING *`,
      [
        id,
        input.workspaceId,
        input.name,
        input.kind,
        input.config.ciphertext,
        input.config.nonce,
        input.config.tag,
      ],
    );
    return this.map(result.rows[0]!);
  }

  public async recordTest(
    workspaceId: string,
    id: string,
    successful: boolean,
    result: string,
  ): Promise<ProviderRecord | null> {
    const query = await this.database.pool.query<ProviderRow>(
      `UPDATE provider_connections
       SET status = $3, last_tested_at = now(), last_test_result = $4, updated_at = now()
       WHERE workspace_id = $1 AND id = $2 AND status <> 'DISABLED'
       RETURNING *`,
      [workspaceId, id, successful ? 'READY' : 'UNHEALTHY', result],
    );
    return query.rows[0] ? this.map(query.rows[0]) : null;
  }

  public async disable(workspaceId: string, id: string): Promise<boolean> {
    const result = await this.database.pool.query(
      `UPDATE provider_connections SET status = 'DISABLED', updated_at = now()
       WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, id],
    );
    return result.rowCount === 1;
  }

  private map(row: ProviderRow): ProviderRecord {
    return {
      config:
        row.config_ciphertext && row.config_nonce && row.config_tag
          ? { ciphertext: row.config_ciphertext, nonce: row.config_nonce, tag: row.config_tag }
          : null,
      createdAt: row.created_at,
      id: row.id,
      kind: row.kind,
      lastTestResult: row.last_test_result,
      lastTestedAt: row.last_tested_at,
      name: row.name,
      status: row.status,
      updatedAt: row.updated_at,
      workspaceId: row.workspace_id,
    };
  }
}
