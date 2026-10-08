import { describe, expect, it, vi } from 'vitest';

import { ProviderRateLimiter } from '../src/delivery/provider-rate-limiter.js';

describe('provider rate limiter', () => {
  it('makes work above the configured limit wait for the next window', async () => {
    vi.useFakeTimers();
    const limiter = new ProviderRateLimiter();
    await limiter.acquire('provider-1', 1);
    let acquired = false;
    const next = limiter.acquire('provider-1', 1).then(() => {
      acquired = true;
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(acquired).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await next;
    expect(acquired).toBe(true);
    vi.useRealTimers();
  });
});
