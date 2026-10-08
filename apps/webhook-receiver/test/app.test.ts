import { signWebhook } from '@zapx/security';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildReceiver } from '../src/app.js';

const secret = 'test-webhook-signing-secret';
let application: ReturnType<typeof buildReceiver>;

describe('signed webhook receiver', () => {
  beforeEach(async () => {
    application = buildReceiver(secret);
    await application.ready();
  });

  afterEach(async () => application.close());

  it('accepts a valid delivery once and identifies a replay', async () => {
    const body = JSON.stringify({ message: 'hello' });
    const timestamp = Math.floor(Date.now() / 1_000).toString();
    const headers = {
      'content-type': 'application/json',
      'zapx-delivery-id': 'delivery-1',
      'zapx-signature': signWebhook(secret, 'delivery-1', timestamp, body),
      'zapx-timestamp': timestamp,
    };
    expect(
      (await application.inject({ body, headers, method: 'POST', url: '/deliveries' })).statusCode,
    ).toBe(202);
    expect(
      (await application.inject({ body, headers, method: 'POST', url: '/deliveries' })).json(),
    ).toMatchObject({ duplicate: true });
  });

  it('rejects an invalid signature', async () => {
    const response = await application.inject({
      body: '{}',
      headers: {
        'content-type': 'application/json',
        'zapx-delivery-id': 'delivery-2',
        'zapx-signature': 'v1=invalid',
        'zapx-timestamp': Math.floor(Date.now() / 1_000).toString(),
      },
      method: 'POST',
      url: '/deliveries',
    });
    expect(response.statusCode).toBe(401);
  });
});
