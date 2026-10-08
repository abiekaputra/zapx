import { describe, expect, it } from 'vitest';

import { retryDelay } from '../src/delivery/retry-policy.js';

describe('delivery retry policy', () => {
  it('uses two bounded, jittered delays before exhaustion', () => {
    const first = retryDelay(1, 'notification-a');
    const second = retryDelay(2, 'notification-a');
    expect(first).toBeGreaterThanOrEqual(5_000);
    expect(first).toBeLessThanOrEqual(6_000);
    expect(second).toBeGreaterThanOrEqual(30_000);
    expect(second).toBeLessThanOrEqual(36_000);
    expect(retryDelay(3, 'notification-a')).toBeNull();
  });
});
