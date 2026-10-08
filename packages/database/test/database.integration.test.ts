import { hashSecret, PayloadCipher, sha256 } from '@zapx/security';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ApiKeyRepository,
  DatabasePool,
  DeliveryRepository,
  IdentityRepository,
  IdempotencyConflictError,
  migrate,
  NotificationRepository,
  OutboxRepository,
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
let submittedNotificationId: string;

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
    submittedNotificationId = accepted.response.id;
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

  it('publishes outbox work and records retry exhaustion without losing attempts', async () => {
    const outbox = new OutboxRepository(database);
    const published: string[] = [];
    await expect(
      outbox.publishPending(async (event) => {
        published.push(event.notificationId);
      }),
    ).resolves.toBe(1);
    expect(published).toEqual([submittedNotificationId]);

    const deliveries = new DeliveryRepository(database);
    const first = await deliveries.claim(submittedNotificationId);
    expect(first?.attemptNumber).toBe(1);
    await deliveries.complete({
      attemptId: first!.attemptId,
      durationMs: 20,
      errorCode: 'SMTP_451',
      errorSummary: 'Temporary failure',
      nextAttemptAt: new Date(Date.now() + 5_000),
      notificationId: submittedNotificationId,
      outcome: 'TRANSIENT_FAILURE',
      providerRequestId: null,
    });

    const second = await deliveries.claim(submittedNotificationId);
    expect(second?.attemptNumber).toBe(2);
    await deliveries.complete({
      attemptId: second!.attemptId,
      durationMs: 25,
      errorCode: 'SMTP_550',
      errorSummary: 'Rejected',
      nextAttemptAt: null,
      notificationId: submittedNotificationId,
      outcome: 'PERMANENT_FAILURE',
      providerRequestId: null,
    });
    const state = await database.pool.query<{ attempts: string; status: string }>(
      `SELECT n.status, count(a.id)::text AS attempts
       FROM notifications n JOIN delivery_attempts a ON a.notification_id = n.id
       WHERE n.id = $1 GROUP BY n.status`,
      [submittedNotificationId],
    );
    expect(state.rows[0]).toEqual({ attempts: '2', status: 'DEAD_LETTER' });

    await expect(
      deliveries.replay({
        actorId: userId,
        actorLabel: 'owner@zapx.local',
        actorType: 'USER',
        notificationId: submittedNotificationId,
        traceId: 'manual-replay-trace',
        workspaceId,
      }),
    ).resolves.toBe(true);
    const replay = await database.pool.query<{ audits: string; outbox: string; status: string }>(
      `SELECT n.status,
              (SELECT count(*) FROM audit_events
               WHERE target_id = n.id AND action = 'notification.replayed')::text AS audits,
              (SELECT count(*) FROM outbox_events
               WHERE aggregate_id = n.id AND event_type = 'notification.replayed')::text AS outbox
       FROM notifications n WHERE n.id = $1`,
      [submittedNotificationId],
    );
    expect(replay.rows[0]).toEqual({ audits: '1', outbox: '1', status: 'ACCEPTED' });

    await outbox.publishPending(async () => undefined);
    const manual = await deliveries.claim(submittedNotificationId);
    expect(manual).toMatchObject({ attemptNumber: 3, cycleAttempt: 1 });
    await deliveries.complete({
      attemptId: manual!.attemptId,
      durationMs: 10,
      errorCode: null,
      errorSummary: null,
      nextAttemptAt: null,
      notificationId: submittedNotificationId,
      outcome: 'SUCCEEDED',
      providerRequestId: 'manual-success',
    });
    await expect(deliveries.claim(submittedNotificationId)).resolves.toBeNull();
  });

  it('retains queue publication failures for a later relay attempt', async () => {
    const eventId = uuidv7();
    await database.pool.query(
      `INSERT INTO outbox_events(
         id, aggregate_type, aggregate_id, event_type, schema_version, payload, occurred_at
       ) VALUES ($1, 'NOTIFICATION', $2, 'notification.replayed', 1, $3, now())`,
      [
        eventId,
        submittedNotificationId,
        {
          notification_id: submittedNotificationId,
          trace_id: 'failed-relay-trace',
          workspace_id: workspaceId,
        },
      ],
    );
    const outbox = new OutboxRepository(database);
    await expect(
      outbox.publishPending(async () => {
        throw new Error('Redis unavailable');
      }),
    ).resolves.toBe(0);
    const event = await database.pool.query(
      'SELECT publish_attempts, last_publish_error, published_at FROM outbox_events WHERE id = $1',
      [eventId],
    );
    expect(event.rows[0]).toMatchObject({
      last_publish_error: 'Redis unavailable',
      publish_attempts: 1,
      published_at: null,
    });
  });

  it('allows competing relays to publish one logical queue event once', async () => {
    const notifications = new NotificationRepository(database);
    const prepared = prepareNotification(2_000);
    await notifications.submit(prepared);
    const publications: string[] = [];
    const relays = Array.from({ length: 4 }, () => new OutboxRepository(database));
    await Promise.all(
      relays.map((relay) =>
        relay.publishPending(async (event) => {
          publications.push(event.notificationId);
        }, 10),
      ),
    );
    expect(publications.filter((id) => id === prepared.notificationId)).toHaveLength(1);
  });

  it('moves a 1,000-notification synthetic batch to a terminal state without losing records', async () => {
    const notifications = new NotificationRepository(database);
    const outbox = new OutboxRepository(database);
    const deliveries = new DeliveryRepository(database);
    const prepared = Array.from({ length: 1_000 }, (_, index) => prepareNotification(index));

    const accepted = await inBatches(prepared, 25, (input) => notifications.submit(input));
    expect(new Set(accepted.map((result) => result.response.id)).size).toBe(1_000);
    const published = await outbox.publishPending(async () => undefined, 1_100);
    expect(published).toBeGreaterThanOrEqual(1_000);

    await inBatches(accepted, 25, async ({ response }) => {
      const claim = await deliveries.claim(response.id);
      await deliveries.complete({
        attemptId: claim!.attemptId,
        durationMs: 1,
        errorCode: null,
        errorSummary: null,
        nextAttemptAt: null,
        notificationId: response.id,
        outcome: 'SUCCEEDED',
        providerRequestId: `simulated-${response.id}`,
      });
    });

    const result = await database.pool.query<{ delivered: string; distinct_ids: string }>(
      `SELECT count(*) FILTER (WHERE status = 'DELIVERED')::text AS delivered,
                count(DISTINCT id)::text AS distinct_ids
         FROM notifications WHERE id = ANY($1::uuid[])`,
      [accepted.map(({ response }) => response.id)],
    );
    expect(result.rows[0]).toEqual({ delivered: '1000', distinct_ids: '1000' });
  }, 60_000);
});

function tokens(suffix: string) {
  return {
    accessExpiresAt: new Date(Date.now() + 60_000),
    accessHash: sha256(`access-${suffix}`),
    refreshExpiresAt: new Date(Date.now() + 120_000),
    refreshHash: sha256(`refresh-${suffix}`),
  };
}

function prepareNotification(index?: number): PreparedNotification {
  const notificationId = uuidv7();
  const cipher = new PayloadCipher(Buffer.alloc(32, 7));
  const association = `${workspaceId}:${notificationId}`;
  return {
    body: cipher.encrypt('Hello Naya', `${association}:body`),
    channel: 'EMAIL',
    creatorId: userId,
    creatorKind: 'USER',
    idempotencyHash: sha256(index === undefined ? 'integration-key' : `load-key-${index}`),
    notificationId,
    providerConnectionId: providerId,
    recipient: cipher.encrypt('recipient@example.test', `${association}:recipient`),
    recipientFingerprint: cipher.fingerprint('recipient@example.test'),
    requestHash: index === undefined ? 'request-hash' : `load-request-${index}`,
    subject: cipher.encrypt('Order ready', `${association}:subject`),
    templateVersionId,
    traceId: index === undefined ? 'integration-trace' : `load-${index}`,
    workspaceId,
  };
}

async function inBatches<T, R>(
  values: T[],
  size: number,
  operation: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < values.length; start += size) {
    results.push(...(await Promise.all(values.slice(start, start + size).map(operation))));
  }
  return results;
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
