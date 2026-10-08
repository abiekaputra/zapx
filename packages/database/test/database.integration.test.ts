import { hashSecret, PayloadCipher, sha256 } from '@zapx/security';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ApiKeyRepository,
  DatabasePool,
  IdentityRepository,
  IdempotencyConflictError,
  migrate,
  NotificationRepository,
  type LoginIdentity,
  type PreparedNotification,
} from '../src/index.js';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/zapx_test';
const database = new DatabasePool(databaseUrl);
const workspaceId = uuidv7();
const userId = uuidv7();
const providerId = uuidv7();
const templateVersionId = uuidv7();

describe('PostgreSQL repositories', () => {
  beforeAll(async () => {
    await database.pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await migrate(database);
    await seedReferences();
  });

  afterAll(async () => {
    await database.close();
  });

  it('rotates a session and revokes the family after refresh reuse', async () => {
    const identities = new IdentityRepository(database);
    const identity = (await identities.findLoginIdentity('owner@zapx.local'))!;
    expect(identity.workspaceId).toBe(workspaceId);

    await identities.createSession(identity, tokens('first'));
    expect(await identities.authenticateAccess(sha256('access-first'))).toMatchObject({
      actorId: userId,
      role: 'OWNER',
    });

    const rotated = await identities.rotateSession(sha256('refresh-first'), tokens('second'));
    expect(rotated).not.toBeNull();
    expect(await identities.authenticateAccess(sha256('access-first'))).toBeNull();
    expect(await identities.authenticateAccess(sha256('access-second'))).not.toBeNull();

    expect(await identities.rotateSession(sha256('refresh-first'), tokens('third'))).toBeNull();
    expect(await identities.authenticateAccess(sha256('access-second'))).toBeNull();
  });

  it('authenticates an API key by prefix and hash until revocation', async () => {
    const keys = new ApiKeyRepository(database);
    const key = await keys.create({
      creatorUserId: userId,
      expiresAt: null,
      name: 'Integration key',
      prefix: 'a1b2c3d4e5f6',
      scopes: ['notifications:write'],
      secretHash: await hashSecret('machine-secret'),
      workspaceId,
    });

    await expect(keys.authenticate(key.prefix, 'wrong-secret')).resolves.toBeNull();
    await expect(keys.authenticate(key.prefix, 'machine-secret')).resolves.toMatchObject({
      actorId: key.id,
      workspaceId,
    });
    await expect(keys.revoke(workspaceId, key.id)).resolves.toBe(true);
    await expect(keys.authenticate(key.prefix, 'machine-secret')).resolves.toBeNull();
  });

  it('commits one encrypted notification and outbox event idempotently', async () => {
    const notifications = new NotificationRepository(database);
    expect(
      await notifications.loadTemplate(workspaceId, templateVersionId, providerId),
    ).toMatchObject({ channel: 'EMAIL' });
    expect(await notifications.loadTemplate(uuidv7(), templateVersionId, providerId)).toBeNull();

    const prepared = prepareNotification();
    const accepted = await notifications.submit(prepared);
    const replayed = await notifications.submit({ ...prepared, notificationId: uuidv7() });
    expect(accepted.replayed).toBe(false);
    expect(replayed).toEqual({ replayed: true, response: accepted.response });
    await expect(
      notifications.submit({ ...prepared, notificationId: uuidv7(), requestHash: 'different' }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);

    const counts = await database.pool.query<{
      notifications: string;
      outbox: string;
      plaintext: string;
    }>(`SELECT
          (SELECT count(*) FROM notifications)::text AS notifications,
          (SELECT count(*) FROM outbox_events)::text AS outbox,
          (SELECT count(*) FROM notifications
             WHERE recipient_ciphertext LIKE '%recipient@example.test%')::text AS plaintext`);
    expect(counts.rows[0]).toEqual({ notifications: '1', outbox: '1', plaintext: '0' });
  });
});

function tokens(suffix: string) {
  return {
    accessExpiresAt: new Date(Date.now() + 60_000),
    accessHash: sha256(`access-${suffix}`),
    refreshExpiresAt: new Date(Date.now() + 120_000),
    refreshHash: sha256(`refresh-${suffix}`),
  };
}

function prepareNotification(): PreparedNotification {
  const notificationId = uuidv7();
  const cipher = new PayloadCipher(Buffer.alloc(32, 7));
  const association = `${workspaceId}:${notificationId}`;
  return {
    body: cipher.encrypt('Hello Naya', `${association}:body`),
    channel: 'EMAIL',
    creatorId: userId,
    creatorKind: 'USER',
    idempotencyHash: sha256('integration-key'),
    notificationId,
    providerConnectionId: providerId,
    recipient: cipher.encrypt('recipient@example.test', `${association}:recipient`),
    recipientFingerprint: cipher.fingerprint('recipient@example.test'),
    requestHash: 'request-hash',
    subject: cipher.encrypt('Order ready', `${association}:subject`),
    templateVersionId,
    traceId: 'integration-trace',
    workspaceId,
  };
}

async function seedReferences(): Promise<void> {
  const identity: LoginIdentity = {
    displayName: 'Local Owner',
    email: 'owner@zapx.local',
    passwordHash: await hashSecret('local-zapx-owner'),
    role: 'OWNER',
    userId,
    workspaceId,
  };
  const templateId = uuidv7();
  await database.pool.query(
    "INSERT INTO workspaces(id, slug, name, status) VALUES ($1, 'demo', 'Demo', 'ACTIVE')",
    [workspaceId],
  );
  await database.pool.query(
    `INSERT INTO users(id, email, display_name, password_hash, status)
     VALUES ($1, $2, $3, $4, 'ACTIVE')`,
    [userId, identity.email, identity.displayName, identity.passwordHash],
  );
  await database.pool.query(
    "INSERT INTO memberships(workspace_id, user_id, role) VALUES ($1, $2, 'OWNER')",
    [workspaceId, userId],
  );
  await database.pool.query(
    `INSERT INTO provider_connections(id, workspace_id, name, kind, status)
     VALUES ($1, $2, 'Local SMTP', 'SMTP', 'READY')`,
    [providerId, workspaceId],
  );
  await database.pool.query(
    `INSERT INTO templates(id, workspace_id, name, channel, status)
     VALUES ($1, $2, 'Order ready', 'EMAIL', 'ACTIVE')`,
    [templateId, workspaceId],
  );
  await database.pool.query(
    `INSERT INTO template_versions(
       id, template_id, version_number, subject_template, body_template,
       required_variables, published_at, creator_user_id
     ) VALUES ($1, $2, 1, 'Order {{reference}}', 'Hello {{first_name}}',
               ARRAY['first_name', 'reference'], now(), $3)`,
    [templateVersionId, templateId, userId],
  );
}
