import { describe, expect, it } from 'vitest';

import { healthResponseSchema } from '../src/index.js';

describe('health response contract', () => {
  it('accepts the documented response', () => {
    const result = healthResponseSchema.safeParse({
      service: 'api',
      status: 'ok',
      timestamp: '2026-10-08T00:00:00.000Z',
      version: '0.1.0',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an unknown health status', () => {
    const result = healthResponseSchema.safeParse({
      service: 'api',
      status: 'unknown',
      timestamp: '2026-10-08T00:00:00.000Z',
      version: '0.1.0',
    });

    expect(result.success).toBe(false);
  });
});
