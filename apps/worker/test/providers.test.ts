import { verifyWebhook } from '@zapx/security';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { assertSafeDestination, UnsafeDestinationError } from '../src/providers/network-policy.js';
import { WebhookProvider } from '../src/providers/webhook.provider.js';

afterEach(() => vi.unstubAllGlobals());

describe('webhook provider', () => {
  it('signs the exact body and accepts a successful destination', async () => {
    const secret = 'test-webhook-signing-secret';
    let verified = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: URL, init: RequestInit) => {
        const headers = init.headers as Record<string, string>;
        const body = String(init.body);
        verified = verifyWebhook(
          secret,
          headers['zapx-delivery-id']!,
          headers['zapx-timestamp']!,
          body,
          headers['zapx-signature']!,
        );
        return new Response(null, { status: 202 });
      }),
    );
    const provider = new WebhookProvider(new Set(['receiver.test']));
    const result = await provider.deliver(
      { signing_secret: secret, url: 'https://receiver.test/delivery' },
      {
        body: 'hello',
        deliveryId: 'delivery-1',
        recipient: 'orders',
        subject: null,
        traceId: 'trace-1',
      },
    );
    expect(result.outcome).toBe('SUCCEEDED');
    expect(verified).toBe(true);
  });

  it('rejects private destinations outside the allowlist', async () => {
    await expect(
      assertSafeDestination(new URL('http://127.0.0.1'), new Set()),
    ).rejects.toBeInstanceOf(UnsafeDestinationError);
  });
});
