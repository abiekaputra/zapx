import { z } from 'zod';

const baseEnvironmentSchema = z.object({
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const serviceEnvironmentSchema = baseEnvironmentSchema.extend({
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().max(65_535),
});

const apiEnvironmentSchema = serviceEnvironmentSchema.extend({
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://zapx:local-zapx-password@127.0.0.1:5434/zapx'),
  ZAPX_MASTER_KEY: z
    .string()
    .default('BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=')
    .refine((value) => Buffer.from(value, 'base64').length === 32, {
      message: 'ZAPX_MASTER_KEY must encode exactly 32 bytes.',
    }),
});

const workerEnvironmentSchema = apiEnvironmentSchema.extend({
  REDIS_URL: z.string().url().default('redis://127.0.0.1:6381'),
  WEBHOOK_ALLOWED_HOSTS: z.string().default('127.0.0.1,localhost,webhook-receiver'),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().max(50).default(5),
});

export type BaseEnvironment = z.infer<typeof baseEnvironmentSchema>;
export type ServiceEnvironment = z.infer<typeof serviceEnvironmentSchema>;
export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;
export type WorkerEnvironment = z.infer<typeof workerEnvironmentSchema>;

export function loadBaseEnvironment(source: NodeJS.ProcessEnv = process.env): BaseEnvironment {
  return baseEnvironmentSchema.parse(source);
}

export function loadServiceEnvironment(
  defaultPort: number,
  source: NodeJS.ProcessEnv = process.env,
): ServiceEnvironment {
  return serviceEnvironmentSchema.parse({
    ...source,
    PORT: source.PORT ?? defaultPort,
  });
}

export function loadApiEnvironment(source: NodeJS.ProcessEnv = process.env): ApiEnvironment {
  assertProductionSecrets(source);
  return apiEnvironmentSchema.parse({
    ...source,
    PORT: source.ZAPX_API_PORT ?? source.PORT ?? 4000,
  });
}

export function loadWorkerEnvironment(source: NodeJS.ProcessEnv = process.env): WorkerEnvironment {
  assertProductionSecrets(source);
  return workerEnvironmentSchema.parse({
    ...source,
    PORT: source.ZAPX_WORKER_HEALTH_PORT ?? source.PORT ?? 4001,
  });
}

function assertProductionSecrets(source: NodeJS.ProcessEnv): void {
  if (source.NODE_ENV !== 'production') return;

  const missing = ['DATABASE_URL', 'ZAPX_MASTER_KEY'].filter((name) => !source[name]);
  if (missing.length > 0) {
    throw new Error(`Production configuration requires: ${missing.join(', ')}.`);
  }
}
