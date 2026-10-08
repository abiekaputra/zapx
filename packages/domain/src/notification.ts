import { z } from 'zod';

export const notificationSubmissionSchema = z.object({
  provider_connection_id: z.string().uuid(),
  recipient: z.string().trim().min(3).max(512),
  template_version_id: z.string().uuid(),
  variables: z.record(z.string(), z.string().max(10_000)).default({}),
});

export type NotificationSubmission = z.infer<typeof notificationSubmissionSchema>;

export interface TemplateSnapshot {
  bodyTemplate: string;
  channel: 'EMAIL' | 'WEBHOOK';
  requiredVariables: string[];
  subjectTemplate: string | null;
}

const placeholderPattern = /{{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*}}/g;

export function renderTemplate(
  template: TemplateSnapshot,
  variables: Record<string, string>,
): { body: string; subject: string | null } {
  const missing = template.requiredVariables.filter((name) => !variables[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required variables: ${missing.join(', ')}`);
  }

  const render = (value: string): string =>
    value.replace(placeholderPattern, (_, name: string) => variables[name] ?? '');

  return {
    body: render(template.bodyTemplate),
    subject: template.subjectTemplate ? render(template.subjectTemplate) : null,
  };
}

export function normalizeRecipient(channel: 'EMAIL' | 'WEBHOOK', value: string): string {
  const normalized = value.trim();

  if (channel === 'EMAIL') {
    return z.string().email().parse(normalized.toLowerCase());
  }

  const url = z.string().url().parse(normalized);
  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    throw new Error('Webhook recipient must use HTTP or HTTPS.');
  }
  return url;
}
