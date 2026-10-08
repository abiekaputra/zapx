import { DatabasePool, migrate } from '../index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required.');

const database = new DatabasePool(connectionString);
try {
  const applied = await migrate(database);
  process.stdout.write(
    applied.length > 0 ? `Applied migrations: ${applied.join(', ')}\n` : 'Database is current.\n',
  );
} finally {
  await database.close();
}
