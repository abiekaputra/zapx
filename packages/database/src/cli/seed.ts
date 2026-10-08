import { loadApiEnvironment } from '@zapx/config';
import { hashSecret, PayloadCipher } from '@zapx/security';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { DatabasePool } from '../pool.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required.');

const database = new DatabasePool(connectionString);
const passwordHash = await hashSecret(process.env.ZAPX_SEED_PASSWORD ?? 'local-zapx-owner');
const cipher = PayloadCipher.fromBase64(loadApiEnvironment().ZAPX_MASTER_KEY);

try {
  await database.transaction(async (client) => {
    const workspaceId = uuidv7();
    const userId = uuidv7();
    const templateId = uuidv7();
    await client.query(
      `INSERT INTO workspaces(id, slug, name, status)
       VALUES ($1, 'demo', 'ZapX Demo', 'ACTIVE')
       ON CONFLICT (slug) DO NOTHING`,
      [workspaceId],
    );
    const workspace = await client.query<{ id: string }>(
      "SELECT id FROM workspaces WHERE slug = 'demo'",
    );
    await client.query(
      `INSERT INTO users(id, email, display_name, password_hash, status)
       VALUES ($1, 'owner@zapx.local', 'Local Owner', $2, 'ACTIVE')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [userId, passwordHash],
    );
    const user = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE email = 'owner@zapx.local'",
    );
    await client.query(
      `INSERT INTO memberships(workspace_id, user_id, role)
       VALUES ($1, $2, 'OWNER') ON CONFLICT DO NOTHING`,
      [workspace.rows[0]!.id, user.rows[0]!.id],
    );
    await seedProvider(client, workspace.rows[0]!.id, 'Local Mailpit', 'SMTP', {
      from: 'notifications@zapx.local',
      host: process.env.SMTP_HOST ?? '127.0.0.1',
      port: Number(process.env.SMTP_PORT ?? 1026),
      secure: false,
    });
    await seedProvider(client, workspace.rows[0]!.id, 'Local Webhook', 'WEBHOOK', {
      signing_secret: process.env.WEBHOOK_SIGNING_SECRET ?? 'local-webhook-secret',
      url: process.env.WEBHOOK_RECEIVER_URL ?? 'http://127.0.0.1:4010/deliveries',
    });
    await client.query(
      `INSERT INTO templates(id, workspace_id, name, channel, status)
       VALUES ($1, $2, 'Order ready', 'EMAIL', 'ACTIVE')
       ON CONFLICT (workspace_id, name) DO NOTHING`,
      [templateId, workspace.rows[0]!.id],
    );
    const template = await client.query<{ id: string }>(
      "SELECT id FROM templates WHERE workspace_id = $1 AND name = 'Order ready'",
      [workspace.rows[0]!.id],
    );
    await client.query(
      `INSERT INTO template_versions(
         id, template_id, version_number, subject_template, body_template,
         required_variables, published_at, creator_user_id
       ) VALUES ($1, $2, 1, 'Order {{reference}} is ready',
                 'Hello {{first_name}}, your order {{reference}} is ready.',
                 ARRAY['first_name', 'reference'], now(), $3)
       ON CONFLICT (template_id, version_number) DO NOTHING`,
      [uuidv7(), template.rows[0]!.id, user.rows[0]!.id],
    );
  });
  process.stdout.write('Synthetic local workspace is ready.\n');
} finally {
  await database.close();
}

async function seedProvider(
  client: PoolClient,
  workspaceId: string,
  name: string,
  kind: 'SMTP' | 'WEBHOOK',
  config: Record<string, unknown>,
): Promise<void> {
  const existing = await client.query<{ id: string }>(
    'SELECT id FROM provider_connections WHERE workspace_id = $1 AND name = $2',
    [workspaceId, name],
  );
  const providerId = existing.rows[0]?.id ?? uuidv7();
  const encrypted = cipher.encrypt(JSON.stringify(config), `${workspaceId}:${providerId}:config`);
  await client.query(
    `INSERT INTO provider_connections(
       id, workspace_id, name, kind, status, config_ciphertext, config_nonce, config_tag
     ) VALUES ($1, $2, $3, $4, 'READY', $5, $6, $7)
     ON CONFLICT (workspace_id, name) DO UPDATE
       SET kind = EXCLUDED.kind, status = 'READY',
           config_ciphertext = EXCLUDED.config_ciphertext,
           config_nonce = EXCLUDED.config_nonce, config_tag = EXCLUDED.config_tag,
           updated_at = now()`,
    [providerId, workspaceId, name, kind, encrypted.ciphertext, encrypted.nonce, encrypted.tag],
  );
}
