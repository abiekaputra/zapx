import type { ClaimedDelivery, DeliveryCompletion, DeliveryRepository } from '@zapx/database';
import { PayloadCipher } from '@zapx/security';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DeliveryProcessor } from '../src/delivery/delivery.processor.js';
import { RetryableDeliveryError } from '../src/delivery/retry-policy.js';
import { ProviderRateLimiter } from '../src/delivery/provider-rate-limiter.js';

const cipher = PayloadCipher.fromBase64('BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=');

afterEach(() => vi.unstubAllGlobals());

describe('delivery processor failures', () => {
  it('schedules a transient failure within the active retry cycle', async () => {
    const { completions, processor } = setup(1);
    await expect(processor.process('notification-1')).rejects.toBeInstanceOf(
      RetryableDeliveryError,
    );
    expect(completions[0]?.outcome).toBe('TRANSIENT_FAILURE');
    expect(completions[0]?.nextAttemptAt).toBeInstanceOf(Date);
  });

  it('dead letters a transient failure after the third automatic attempt', async () => {
    const { completions, processor } = setup(3);
    await expect(processor.process('notification-1')).resolves.toBeUndefined();
    expect(completions[0]).toMatchObject({
      nextAttemptAt: null,
      outcome: 'TRANSIENT_FAILURE',
    });
  });
});

function setup(cycleAttempt: number) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 503 })),
  );
  const completions: DeliveryCompletion[] = [];
  const repository = {
    claim: async () => claimed(cycleAttempt),
    complete: async (completion: DeliveryCompletion) => {
      completions.push(completion);
    },
  } as unknown as DeliveryRepository;
  return { completions, processor: new DeliveryProcessor(repository, new ProviderRateLimiter()) };
}

function claimed(cycleAttempt: number): ClaimedDelivery {
  const workspaceId = 'workspace-1';
  const notificationId = 'notification-1';
  const providerConnectionId = 'provider-1';
  const association = `${workspaceId}:${notificationId}`;
  return {
    attemptId: `attempt-${cycleAttempt}`,
    attemptNumber: cycleAttempt,
    body: cipher.encrypt('hello', `${association}:body`),
    channel: 'WEBHOOK',
    cycleAttempt,
    notificationId,
    providerConfig: cipher.encrypt(
      JSON.stringify({
        signing_secret: 'test-webhook-signing-secret',
        url: 'http://127.0.0.1/deliveries',
      }),
      `${workspaceId}:${providerConnectionId}:config`,
    ),
    providerConnectionId,
    recipient: cipher.encrypt('orders', `${association}:recipient`),
    subject: null,
    traceId: 'trace-1',
    workspaceId,
  };
}
