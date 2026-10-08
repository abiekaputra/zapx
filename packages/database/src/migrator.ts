import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { DatabasePool } from './pool.js';

const migrationsDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));

export async function migrate(database: DatabasePool): Promise<string[]> {
  await database.pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql')).sort();
  const applied: string[] = [];

  for (const file of files) {
    const existing = await database.pool.query(
      'SELECT 1 FROM schema_migrations WHERE version = $1',
      [file],
    );
    if (existing.rowCount) continue;

    const sql = await readFile(`${migrationsDirectory}/${file}`, 'utf8');
    await database.transaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [file]);
    });
    applied.push(file);
  }

  return applied;
}
