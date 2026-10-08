import { z } from 'zod';

const baseEnvironmentSchema = z.object({
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const serviceEnvironmentSchema = baseEnvironmentSchema.extend({
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().max(65_535),
});

export type BaseEnvironment = z.infer<typeof baseEnvironmentSchema>;
export type ServiceEnvironment = z.infer<typeof serviceEnvironmentSchema>;

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
