import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(256),
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(40).max(512),
});

export const createApiKeySchema = z.object({
  expires_at: z.string().datetime().nullable().optional(),
  name: z.string().trim().min(2).max(80),
  scopes: z
    .array(z.enum(['notifications:read', 'notifications:write']))
    .min(1)
    .max(2),
});

export type Role = 'OWNER' | 'OPERATOR' | 'VIEWER';

export interface Principal {
  actorId: string;
  actorLabel: string;
  kind: 'USER' | 'API_KEY';
  role?: Role;
  scopes: string[];
  workspaceId: string;
}
