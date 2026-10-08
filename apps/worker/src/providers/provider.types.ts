import { z } from 'zod';

export const smtpConfigSchema = z.object({
  from: z.string().email(),
  host: z.string().min(1),
  port: z.number().int().positive().max(65_535),
  secure: z.boolean(),
});

export const webhookConfigSchema = z.object({
  signing_secret: z.string().min(16),
  url: z.string().url(),
});

export interface DeliveryMessage {
  body: string;
  deliveryId: string;
  recipient: string;
  subject: string | null;
  traceId: string;
}

export interface ProviderResult {
  errorCode: string | null;
  errorSummary: string | null;
  outcome: 'SUCCEEDED' | 'TRANSIENT_FAILURE' | 'PERMANENT_FAILURE' | 'INDETERMINATE';
  providerRequestId: string | null;
}

export interface DeliveryProvider<TConfig> {
  deliver(config: TConfig, message: DeliveryMessage): Promise<ProviderResult>;
}

export type SmtpConfig = z.infer<typeof smtpConfigSchema>;
export type WebhookConfig = z.infer<typeof webhookConfigSchema>;
