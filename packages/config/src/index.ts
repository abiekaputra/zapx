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

export type BaseEnvironment = z.infer<typeof baseEnvironmentSchema>;
export type ServiceEnvironment = z.infer<typeof serviceEnvironmentSchema>;
export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;

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
  return apiEnvironmentSchema.parse({
    ...source,
    PORT: source.ZAPX_API_PORT ?? source.PORT ?? 4000,
  });
}
