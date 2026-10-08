import type { Principal, Role } from '@zapx/domain';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import type { DatabasePool } from './pool.js';

interface LoginRow extends QueryResultRow {
  display_name: string;
  email: string;
  password_hash: string;
  role: Role;
  user_id: string;
  workspace_id: string;
}

interface SessionRow extends QueryResultRow {
  display_name: string;
  email: string;
  role: Role;
  rotated_at: Date | null;
  revoked_at: Date | null;
  token_family_id: string;
  user_id: string;
  workspace_id: string;
}

export interface LoginIdentity {
  displayName: string;
  email: string;
  passwordHash: string;
  role: Role;
  userId: string;
  workspaceId: string;
}

export interface SessionTokens {
  accessHash: string;
  accessExpiresAt: Date;
  refreshHash: string;
  refreshExpiresAt: Date;
}

export class IdentityRepository {
  public constructor(private readonly database: DatabasePool) {}

  public async findLoginIdentity(email: string): Promise<LoginIdentity | null> {
    const result = await this.database.pool.query<LoginRow>(
      `SELECT u.id AS user_id, u.email, u.display_name, u.password_hash,
              m.workspace_id, m.role
       FROM users u
       JOIN memberships m ON m.user_id = u.id
       JOIN workspaces w ON w.id = m.workspace_id
       WHERE u.email = $1 AND u.status = 'ACTIVE' AND w.status = 'ACTIVE'
       ORDER BY m.created_at ASC
       LIMIT 1`,
      [email],
    );
    const row = result.rows[0];
    return row ? this.toLoginIdentity(row) : null;
  }

  public async createSession(
    identity: LoginIdentity,
    tokens: SessionTokens,
    familyId = uuidv7(),
  ): Promise<string> {
    const sessionId = uuidv7();
    await this.insertSession(this.database.pool, sessionId, identity, tokens, familyId);
    await this.database.pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [
      identity.userId,
    ]);
    return sessionId;
  }

  public async authenticateAccess(accessHash: string): Promise<Principal | null> {
    const result = await this.database.pool.query<SessionRow>(
      `SELECT s.user_id, s.workspace_id, s.token_family_id,
              u.email, u.display_name, m.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN memberships m ON m.user_id = s.user_id AND m.workspace_id = s.workspace_id
       JOIN workspaces w ON w.id = s.workspace_id
       WHERE s.access_token_hash = $1
         AND s.revoked_at IS NULL
         AND s.access_expires_at > now()
         AND u.status = 'ACTIVE'
         AND w.status = 'ACTIVE'`,
      [accessHash],
    );
    const row = result.rows[0];
    return row ? this.toPrincipal(row) : null;
  }

  public async rotateSession(
    refreshHash: string,
    tokens: SessionTokens,
  ): Promise<{ identity: LoginIdentity; sessionId: string } | null> {
    return this.database.transaction(async (client) => {
      const result = await client.query<
        SessionRow & Pick<LoginRow, 'password_hash'> & { id: string; refresh_valid: boolean }
      >(
        `SELECT s.id, s.user_id, s.workspace_id, s.token_family_id,
                s.rotated_at, s.revoked_at,
                (s.refresh_expires_at > now()) AS refresh_valid,
                u.email, u.display_name, u.password_hash, m.role
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         JOIN memberships m ON m.user_id = s.user_id AND m.workspace_id = s.workspace_id
         WHERE s.refresh_token_hash = $1
         FOR UPDATE OF s`,
        [refreshHash],
      );
      const row = result.rows[0];
      if (!row) return null;

      if (row.rotated_at || row.revoked_at || !row.refresh_valid) {
        await client.query(
          'UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE token_family_id = $1',
          [row.token_family_id],
        );
        return null;
      }

      await client.query(
        'UPDATE sessions SET rotated_at = now(), revoked_at = now() WHERE id = $1',
        [row.id],
      );
      const identity = this.toLoginIdentity(row);
      const sessionId = uuidv7();
      await this.insertSession(client, sessionId, identity, tokens, row.token_family_id);
      return { identity, sessionId };
    });
  }

  public async revokeFamily(accessHash: string): Promise<void> {
    await this.database.pool.query(
      `UPDATE sessions SET revoked_at = COALESCE(revoked_at, now())
       WHERE token_family_id = (
         SELECT token_family_id FROM sessions WHERE access_token_hash = $1
       )`,
      [accessHash],
    );
  }

  private async insertSession(
    client: Pool | PoolClient,
    id: string,
    identity: LoginIdentity,
    tokens: SessionTokens,
    familyId: string,
  ): Promise<void> {
    await client.query(
      `INSERT INTO sessions(
         id, user_id, workspace_id, token_family_id, access_token_hash,
         refresh_token_hash, access_expires_at, refresh_expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        identity.userId,
        identity.workspaceId,
        familyId,
        tokens.accessHash,
        tokens.refreshHash,
        tokens.accessExpiresAt,
        tokens.refreshExpiresAt,
      ],
    );
  }

  private toLoginIdentity(row: LoginRow): LoginIdentity {
    return {
      displayName: row.display_name,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      userId: row.user_id,
      workspaceId: row.workspace_id,
    };
  }

  private toPrincipal(row: SessionRow): Principal {
    return {
      actorId: row.user_id,
      actorLabel: row.email,
      kind: 'USER',
      role: row.role,
      scopes: ['notifications:read', 'notifications:write'],
      workspaceId: row.workspace_id,
    };
  }
}
