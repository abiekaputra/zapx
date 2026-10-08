import { Inject, Injectable } from '@nestjs/common';
import { loadWorkerEnvironment } from '@zapx/config';
import { DeliveryRepository, type ClaimedDelivery, type DeliveryCompletion } from '@zapx/database';
import { PayloadCipher } from '@zapx/security';

import {
  smtpConfigSchema,
  webhookConfigSchema,
  type DeliveryMessage,
  type ProviderResult,
} from '../providers/provider.types.js';
import { SmtpProvider } from '../providers/smtp.provider.js';
import { WebhookProvider } from '../providers/webhook.provider.js';
import { RetryableDeliveryError, retryDelay } from './retry-policy.js';

@Injectable()
export class DeliveryProcessor {
  private readonly cipher = PayloadCipher.fromBase64(loadWorkerEnvironment().ZAPX_MASTER_KEY);
  private readonly smtp = new SmtpProvider();
  private readonly webhook = new WebhookProvider(
    new Set(
      loadWorkerEnvironment()
        .WEBHOOK_ALLOWED_HOSTS.split(',')
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  public constructor(
    @Inject(DeliveryRepository)
    private readonly deliveries: DeliveryRepository,
  ) {}

  public async process(notificationId: string): Promise<void> {
    const delivery = await this.deliveries.claim(notificationId);
    if (!delivery) return;
    const startedAt = Date.now();
    const result = await this.callProvider(delivery);
    const delay =
      result.outcome === 'TRANSIENT_FAILURE'
        ? retryDelay(delivery.cycleAttempt, delivery.notificationId)
        : null;
    const completion: DeliveryCompletion = {
      attemptId: delivery.attemptId,
      durationMs: Date.now() - startedAt,
      errorCode: result.errorCode,
      errorSummary: result.errorSummary,
      nextAttemptAt: delay === null ? null : new Date(Date.now() + delay),
      notificationId: delivery.notificationId,
      outcome: result.outcome,
      providerRequestId: result.providerRequestId,
    };
    await this.deliveries.complete(completion);
    if (delay !== null) throw new RetryableDeliveryError(delay);
  }

  private async callProvider(delivery: ClaimedDelivery): Promise<ProviderResult> {
    try {
      if (!delivery.providerConfig) throw new Error('Provider configuration is unavailable.');
      const association = `${delivery.workspaceId}:${delivery.notificationId}`;
      const message: DeliveryMessage = {
        body: this.cipher.decrypt(delivery.body, `${association}:body`),
        deliveryId: delivery.attemptId,
        recipient: this.cipher.decrypt(delivery.recipient, `${association}:recipient`),
        subject: delivery.subject
          ? this.cipher.decrypt(delivery.subject, `${association}:subject`)
          : null,
        traceId: delivery.traceId,
      };
      const config = JSON.parse(
        this.cipher.decrypt(
          delivery.providerConfig,
          `${delivery.workspaceId}:${delivery.providerConnectionId}:config`,
        ),
      ) as unknown;
      return delivery.channel === 'EMAIL'
        ? this.smtp.deliver(smtpConfigSchema.parse(config), message)
        : this.webhook.deliver(webhookConfigSchema.parse(config), message);
    } catch (error) {
      return {
        errorCode: 'PROVIDER_CONFIG_INVALID',
        errorSummary: error instanceof Error ? error.message : 'Provider configuration is invalid.',
        outcome: 'PERMANENT_FAILURE',
        providerRequestId: null,
      };
    }
  }
}
