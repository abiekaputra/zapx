import type { RedisOptions } from 'ioredis';

export function redisOptions(connectionUrl: string): RedisOptions {
  const url = new URL(connectionUrl);
  const database = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0;
  const options: RedisOptions = {
    db: Number.isInteger(database) ? database : 0,
    host: url.hostname,
    maxRetriesPerRequest: null,
    port: Number(url.port || 6379),
  };
  if (url.password) options.password = decodeURIComponent(url.password);
  if (url.protocol === 'rediss:') options.tls = {};
  if (url.username) options.username = decodeURIComponent(url.username);
  return options;
}
