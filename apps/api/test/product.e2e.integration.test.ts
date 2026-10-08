import fastifyCookie from '@fastify/cookie';
import { Test } from '@nestjs/testing';
import { DatabasePool, migrate } from '@zapx/database';
import { hashSecret } from '@zapx/security';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { ProblemFilter } from '../src/common/problem.filter.js';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/zapx_test';
const database = new DatabasePool(databaseUrl);
const workspaceId = uuidv7();
const userId = uuidv7();
const providerId = uuidv7();
const templateVersionId = uuidv7();
let application: NestFastifyApplication;
let accessToken: string;
let browserCookies: string;
let csrfToken: string;
let apiKey: string;
let notificationId: string;

describe('Phase 4 API flow', () => {
  beforeAll(async () => {
    await database.pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await migrate(database);
    await seedProductReferences();
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    application = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await application.register(fastifyCookie);
    application.useGlobalFilters(new ProblemFilter());
    await application.init();
    await application.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await application.close();
    await database.close();
  });

  it('returns the same generic response for invalid credentials', async () => {
    const response = await inject('POST', '/v1/auth/login', {
      email: 'unknown@zapx.local',
      password: 'incorrect-password',
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'AUTHENTICATION_FAILED' });
  });

  it('logs in a seeded owner and exposes the scoped identity', async () => {
    const login = await inject('POST', '/v1/auth/login', {
      email: 'owner@zapx.local',
      password: 'local-zapx-owner',
    });
    expect(login.statusCode).toBe(200);
    accessToken = cookieValue(login.headers['set-cookie'], 'zapx_access');
    csrfToken = cookieValue(login.headers['set-cookie'], 'zapx_csrf');
    browserCookies = cookieHeader(login.headers['set-cookie']);

    const me = await inject('GET', '/v1/auth/me', undefined, accessToken);
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ role: 'OWNER', workspace_id: workspaceId });
  });

  it('creates an API key whose secret is returned once', async () => {
    const body = {
      name: 'Integration client',
      scopes: ['notifications:read', 'notifications:write'],
    };
    const rejected = await application.inject({
      headers: { cookie: browserCookies },
      method: 'POST',
      payload: body,
      url: '/v1/api-keys',
    });
    expect(rejected.statusCode).toBe(403);

    const created = await application.inject({
      headers: { cookie: browserCookies, 'x-csrf-token': csrfToken },
      method: 'POST',
      payload: body,
      url: '/v1/api-keys',
    });
    expect(created.statusCode).toBe(201);
    apiKey = created.json().secret as string;
    expect(apiKey).toMatch(/^zx_key_[a-f0-9]{12}_/);

    const listed = await inject('GET', '/v1/api-keys', undefined, accessToken);
    expect(listed.statusCode).toBe(200);
    expect(JSON.stringify(listed.json())).not.toContain(apiKey);
  });

  it('accepts, replays, and rejects conflicting notification intake', async () => {
    const body = {
      provider_connection_id: providerId,
      recipient: 'recipient@example.test',
      template_version_id: templateVersionId,
      variables: { first_name: 'Naya', reference: 'ORDER-1042' },
    };
    const first = await inject('POST', '/v1/notifications', body, apiKey, 'request-1042');
    expect(first.statusCode).toBe(202);
    notificationId = first.json().id as string;
    const replay = await inject('POST', '/v1/notifications', body, apiKey, 'request-1042');
    expect(replay.statusCode).toBe(202);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(replay.json().id).toBe(first.json().id);

    const conflict = await inject(
      'POST',
      '/v1/notifications',
      { ...body, recipient: 'another@example.test' },
      apiKey,
      'request-1042',
    );
    expect(conflict.statusCode).toBe(409);

    const counts = await database.pool.query<{ notifications: string; outbox: string }>(
      `SELECT (SELECT count(*) FROM notifications)::text AS notifications,
              (SELECT count(*) FROM outbox_events)::text AS outbox`,
    );
    expect(counts.rows[0]).toEqual({ notifications: '1', outbox: '1' });
  });

  it('replays a dead letter with retained history and an audit record', async () => {
    await database.pool.query(
      `UPDATE notifications
       SET status = 'DEAD_LETTER', terminal_at = now(), last_error_code = 'SIMULATED'
       WHERE id = $1`,
      [notificationId],
    );
    const replay = await inject('POST', `/v1/notifications/${notificationId}/replay`, {}, apiKey);
    expect(replay.statusCode).toBe(202);
    expect(replay.json()).toMatchObject({ id: notificationId, status: 'ACCEPTED' });
    const evidence = await database.pool.query<{ audits: string; replays: string }>(
      `SELECT
         (SELECT count(*) FROM audit_events WHERE target_id = $1)::text AS audits,
         (SELECT count(*) FROM outbox_events
          WHERE aggregate_id = $1 AND event_type = 'notification.replayed')::text AS replays`,
      [notificationId],
    );
    expect(evidence.rows[0]).toEqual({ audits: '1', replays: '1' });
  });
});

async function inject(
  method: 'GET' | 'POST',
  url: string,
  payload?: Record<string, unknown>,
  token?: string,
  idempotencyKey?: string,
) {
  const headers = {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
  };
  return payload
    ? application.inject({ headers, method, payload, url })
    : application.inject({ headers, method, url });
}

function cookieValue(header: string | string[] | undefined, name: string): string {
  const cookies = Array.isArray(header) ? header : [header ?? ''];
  const encoded = cookies.find((cookie) => cookie.startsWith(`${name}=`))?.split(';')[0];
  if (!encoded) throw new Error(`Cookie ${name} was not set.`);
  return decodeURIComponent(encoded.slice(name.length + 1));
}

function cookieHeader(header: string | string[] | undefined): string {
  const cookies = Array.isArray(header) ? header : [header ?? ''];
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

async function seedProductReferences(): Promise<void> {
  const templateId = uuidv7();
  await database.pool.query(
    "INSERT INTO workspaces(id, slug, name, status) VALUES ($1, 'demo', 'Demo', 'ACTIVE')",
    [workspaceId],
  );
  await database.pool.query(
    `INSERT INTO users(id, email, display_name, password_hash, status)
     VALUES ($1, 'owner@zapx.local', 'Local Owner', $2, 'ACTIVE')`,
    [userId, await hashSecret('local-zapx-owner')],
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
