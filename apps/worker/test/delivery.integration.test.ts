import {
  DatabasePool,
  DeliveryRepository,
  migrate,
  NotificationRepository,
  OutboxRepository,
  type PreparedNotification,
} from '@zapx/database';
import { PayloadCipher, sha256 } from '@zapx/security';
import { SMTPServer } from 'smtp-server';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DeliveryProcessor } from '../src/delivery/delivery.processor.js';
import { ProviderRateLimiter } from '../src/delivery/provider-rate-limiter.js';
import { DeliveryRuntime } from '../src/runtime/delivery.runtime.js';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/zapx_test';
const database = new DatabasePool(databaseUrl);
const cipher = PayloadCipher.fromBase64('BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=');
const workspaceId = uuidv7();
const userId = uuidv7();
const providerId = uuidv7();
const templateVersionId = uuidv7();
let smtp: SMTPServer;
let smtpPort: number;
let received = '';

describe('Phase 5 delivery flow', () => {
  beforeAll(async () => {
    smtp = new SMTPServer({
      authOptional: true,
      disabledCommands: ['STARTTLS'],
      onData(stream, _session, callback) {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => {
          received = Buffer.concat(chunks).toString('utf8');
          callback();
        });
      },
    });
    await new Promise<void>((resolve) => smtp.listen(0, '127.0.0.1', resolve));
    const address = smtp.server.address();
    if (!address || typeof address === 'string') throw new Error('SMTP address unavailable.');
    smtpPort = address.port;
    await database.pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await migrate(database);
    await seedReferences();
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => smtp.close(() => resolve()));
  });

  it('relays an outbox event through Redis and delivers it over SMTP', async () => {
    const notifications = new NotificationRepository(database);
    const prepared = prepareNotification();
    await notifications.submit(prepared);
    const processor = new DeliveryProcessor(
      new DeliveryRepository(database),
      new ProviderRateLimiter(),
    );
    const runtime = new DeliveryRuntime(new OutboxRepository(database), processor, database);
    await runtime.onModuleInit();
    try {
      await waitForDelivered(prepared.notificationId);
      expect(received).toContain('Subject: Order ready');
      expect(received).toContain('Hello Naya');
      const result = await database.pool.query(
        `SELECT n.status, n.attempt_count, a.outcome, a.trace_id
         FROM notifications n JOIN delivery_attempts a ON a.notification_id = n.id
         WHERE n.id = $1`,
        [prepared.notificationId],
      );
      expect(result.rows[0]).toMatchObject({
        attempt_count: 1,
        outcome: 'SUCCEEDED',
        status: 'DELIVERED',
        trace_id: 'phase-five-trace',
      });
    } finally {
      await runtime.onModuleDestroy();
    }
  });
});

function prepareNotification(): PreparedNotification {
  const notificationId = uuidv7();
  const association = `${workspaceId}:${notificationId}`;
  return {
    body: cipher.encrypt('Hello Naya', `${association}:body`),
    channel: 'EMAIL',
    creatorId: userId,
    creatorKind: 'USER',
    idempotencyHash: sha256('phase-five-request'),
    notificationId,
    providerConnectionId: providerId,
    recipient: cipher.encrypt('recipient@example.test', `${association}:recipient`),
    recipientFingerprint: cipher.fingerprint('recipient@example.test'),
    requestHash: 'phase-five-hash',
    subject: cipher.encrypt('Order ready', `${association}:subject`),
    templateVersionId,
    traceId: 'phase-five-trace',
    workspaceId,
  };
}

async function seedReferences(): Promise<void> {
  const config = cipher.encrypt(
    JSON.stringify({
      from: 'zapx@example.test',
      host: '127.0.0.1',
      port: smtpPort,
      secure: false,
    }),
    `${workspaceId}:${providerId}:config`,
  );
  const templateId = uuidv7();
  await database.pool.query(
    `INSERT INTO workspaces(id, slug, name, status)
     VALUES ($1, 'phase-five', 'Phase Five', 'ACTIVE')`,
    [workspaceId],
  );
  await database.pool.query(
    `INSERT INTO users(id, email, display_name, password_hash, status)
     VALUES ($1, 'phase5@example.test', 'Phase Five', 'unused', 'ACTIVE')`,
    [userId],
  );
  await database.pool.query(
    `INSERT INTO provider_connections(
       id, workspace_id, name, kind, status, config_ciphertext, config_nonce, config_tag
     ) VALUES ($1, $2, 'Test SMTP', 'SMTP', 'READY', $3, $4, $5)`,
    [providerId, workspaceId, config.ciphertext, config.nonce, config.tag],
  );
  await database.pool.query(
    `INSERT INTO templates(id, workspace_id, name, channel, status)
     VALUES ($1, $2, 'Test', 'EMAIL', 'ACTIVE')`,
    [templateId, workspaceId],
  );
  await database.pool.query(
    `INSERT INTO template_versions(
       id, template_id, version_number, body_template,
       required_variables, published_at, creator_user_id
     ) VALUES ($1, $2, 1, 'Hello', '{}', now(), $3)`,
    [templateVersionId, templateId, userId],
  );
}

async function waitForDelivered(notificationId: string): Promise<void> {
  for (let count = 0; count < 50; count += 1) {
    const result = await database.pool.query<{ status: string }>(
      'SELECT status FROM notifications WHERE id = $1',
      [notificationId],
    );
    if (result.rows[0]?.status === 'DELIVERED') return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Delivery did not reach DELIVERED.');
}
