import { hashSecret } from '@zapx/security';
import { v7 as uuidv7 } from 'uuid';

import { DatabasePool } from '../pool.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required.');

const database = new DatabasePool(connectionString);
const passwordHash = await hashSecret(process.env.ZAPX_SEED_PASSWORD ?? 'local-zapx-owner');

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
    await client.query(
      `INSERT INTO provider_connections(id, workspace_id, name, kind, status)
       VALUES ($1, $2, 'Local Mailpit', 'SMTP', 'READY')
       ON CONFLICT (workspace_id, name) DO NOTHING`,
      [uuidv7(), workspace.rows[0]!.id],
    );
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
