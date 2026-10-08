import type {
  DeliveryMessage,
  DeliveryProvider,
  ProviderResult,
  WebhookConfig,
} from './provider.types.js';
import { signWebhook } from '@zapx/security';
import { assertSafeDestination, UnsafeDestinationError } from './network-policy.js';

export class WebhookProvider implements DeliveryProvider<WebhookConfig> {
  public constructor(private readonly allowedHosts: Set<string>) {}

  public async deliver(config: WebhookConfig, message: DeliveryMessage): Promise<ProviderResult> {
    const url = new URL(config.url);
    try {
      await assertSafeDestination(url, this.allowedHosts);
      const body = JSON.stringify({
        delivery_id: message.deliveryId,
        message: message.body,
        recipient: message.recipient,
        subject: message.subject,
        trace_id: message.traceId,
      });
      const timestamp = Math.floor(Date.now() / 1_000).toString();
      const response = await fetch(url, {
        body,
        headers: {
          'content-type': 'application/json',
          'zapx-delivery-id': message.deliveryId,
          'zapx-signature': signWebhook(config.signing_secret, message.deliveryId, timestamp, body),
          'zapx-timestamp': timestamp,
          'zapx-trace-id': message.traceId,
        },
        method: 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(5_000),
      });
      return this.classifyResponse(response);
    } catch (error) {
      if (error instanceof UnsafeDestinationError) {
        return this.result('PERMANENT_FAILURE', 'UNSAFE_DESTINATION', error.message);
      }
      const messageText = error instanceof Error ? error.message : 'Webhook request failed';
      return this.result('INDETERMINATE', 'WEBHOOK_NETWORK_ERROR', messageText);
    }
  }

  private classifyResponse(response: Response): ProviderResult {
    const requestId = response.headers.get('x-request-id');
    if (response.ok)
      return { ...this.result('SUCCEEDED', null, null), providerRequestId: requestId };
    const code = `HTTP_${response.status}`;
    const summary = `Webhook destination returned HTTP ${response.status}.`;
    if ([408, 425, 429].includes(response.status) || response.status >= 500) {
      return this.result('TRANSIENT_FAILURE', code, summary);
    }
    return this.result('PERMANENT_FAILURE', code, summary);
  }

  private result(
    outcome: ProviderResult['outcome'],
    errorCode: string | null,
    errorSummary: string | null,
  ): ProviderResult {
    return { errorCode, errorSummary, outcome, providerRequestId: null };
  }
}
