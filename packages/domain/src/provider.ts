import { z } from 'zod';

const smtpConfigSchema = z.object({
  from: z.string().email(),
  host: z.string().trim().min(1).max(255),
  password: z.string().max(512).optional(),
  port: z.coerce.number().int().min(1).max(65_535),
  rate_limit_per_second: z.coerce.number().int().min(1).max(100).default(5),
  secure: z.boolean().default(false),
  username: z.string().trim().max(255).optional(),
});

const webhookConfigSchema = z.object({
  rate_limit_per_second: z.coerce.number().int().min(1).max(100).default(5),
  signing_secret: z.string().min(16).max(512),
  url: z.string().url().max(2_048),
});

export const createProviderSchema = z.discriminatedUnion('kind', [
  z.object({
    config: smtpConfigSchema,
    kind: z.literal('SMTP'),
    name: z.string().trim().min(2).max(80),
  }),
  z.object({
    config: webhookConfigSchema,
    kind: z.literal('WEBHOOK'),
    name: z.string().trim().min(2).max(80),
  }),
]);

export type CreateProvider = z.infer<typeof createProviderSchema>;
export type ProviderConfig = z.infer<typeof smtpConfigSchema> | z.infer<typeof webhookConfigSchema>;
