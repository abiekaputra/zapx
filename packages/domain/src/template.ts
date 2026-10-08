import { z } from 'zod';

export const createTemplateSchema = z.object({
  channel: z.enum(['EMAIL', 'WEBHOOK']),
  name: z.string().trim().min(2).max(100),
});

export const createTemplateVersionSchema = z.object({
  body_template: z.string().trim().min(1).max(50_000),
  required_variables: z.array(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)).max(50),
  subject_template: z.string().trim().max(998).nullable().optional(),
});

export const previewTemplateSchema = z.object({
  variables: z.record(z.string(), z.string().max(10_000)).default({}),
});
