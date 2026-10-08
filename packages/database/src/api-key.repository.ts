import type { Principal } from '@zapx/domain';
import { verifySecret } from '@zapx/security';
import type { QueryResultRow } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import type { DatabasePool } from './pool.js';

interface ApiKeyRow extends QueryResultRow {
  created_at: Date;
  expires_at: Date | null;
  id: string;
  last_used_at: Date | null;
  name: string;
  prefix: string;
  revoked_at: Date | null;
  scopes: string[];
  secret_hash: string;
  workspace_id: string;
}

export interface ApiKeyMetadata {
  createdAt: Date;
  expiresAt: Date | null;
  id: string;
  lastUsedAt: Date | null;
  name: string;
  prefix: string;
  revokedAt: Date | null;
  scopes: string[];
}

export class ApiKeyRepository {
  public constructor(private readonly database: DatabasePool) {}

  public async create(input: {
    creatorUserId: string;
    expiresAt: Date | null;
    name: string;
    prefix: string;
    scopes: string[];
    secretHash: string;
    workspaceId: string;
  }): Promise<ApiKeyMetadata> {
    const result = await this.database.pool.query<ApiKeyRow>(
      `INSERT INTO api_keys(
         id, workspace_id, name, prefix, secret_hash, scopes,
         creator_user_id, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        uuidv7(),
        input.workspaceId,
        input.name,
        input.prefix,
        input.secretHash,
        input.scopes,
        input.creatorUserId,
        input.expiresAt,
      ],
    );
    return this.toMetadata(result.rows[0]!);
  }

  public async list(workspaceId: string): Promise<ApiKeyMetadata[]> {
    const result = await this.database.pool.query<ApiKeyRow>(
      'SELECT * FROM api_keys WHERE workspace_id = $1 ORDER BY created_at DESC',
      [workspaceId],
    );
    return result.rows.map((row) => this.toMetadata(row));
  }

  public async revoke(workspaceId: string, id: string): Promise<boolean> {
    const result = await this.database.pool.query(
      `UPDATE api_keys SET revoked_at = COALESCE(revoked_at, now())
       WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, id],
    );
    return result.rowCount === 1;
  }

  public async authenticate(prefix: string, secret: string): Promise<Principal | null> {
    const result = await this.database.pool.query<ApiKeyRow>(
      `SELECT * FROM api_keys
       WHERE prefix = $1 AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > now())`,
      [prefix],
    );
    const row = result.rows[0];
    if (!row || !(await verifySecret(row.secret_hash, secret))) return null;

    await this.database.pool.query('UPDATE api_keys SET last_used_at = now() WHERE id = $1', [
      row.id,
    ]);
    return {
      actorId: row.id,
      actorLabel: row.name,
      kind: 'API_KEY',
      scopes: row.scopes,
      workspaceId: row.workspace_id,
    };
  }

  private toMetadata(row: ApiKeyRow): ApiKeyMetadata {
    return {
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      id: row.id,
      lastUsedAt: row.last_used_at,
      name: row.name,
      prefix: row.prefix,
      revokedAt: row.revoked_at,
      scopes: row.scopes,
    };
  }
}
