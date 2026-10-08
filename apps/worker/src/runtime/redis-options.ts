import type { ConnectionOptions } from 'bullmq';

export function redisOptions(connectionUrl: string): ConnectionOptions {
  const url = new URL(connectionUrl);
  const database = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0;
  return {
    db: Number.isInteger(database) ? database : 0,
    host: url.hostname,
    maxRetriesPerRequest: null,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    port: Number(url.port || 6379),
    tls: url.protocol === 'rediss:' ? {} : undefined,
    username: url.username ? decodeURIComponent(url.username) : undefined,
  };
}
