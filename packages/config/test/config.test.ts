import { describe, expect, it } from 'vitest';

import { loadApiEnvironment, loadBaseEnvironment, loadServiceEnvironment } from '../src/index.js';

describe('environment loading', () => {
  it('uses safe development defaults', () => {
    expect(loadBaseEnvironment({})).toEqual({
      LOG_LEVEL: 'info',
      NODE_ENV: 'development',
    });
  });

  it('coerces a valid service port', () => {
    expect(loadServiceEnvironment(4000, { PORT: '4100' }).PORT).toBe(4100);
  });

  it('rejects an invalid service port', () => {
    expect(() => loadServiceEnvironment(4000, { PORT: 'invalid' })).toThrow();
  });

  it('requires explicit database and encryption secrets in production', () => {
    expect(() => loadApiEnvironment({ NODE_ENV: 'production' })).toThrow(
      'Production configuration requires: DATABASE_URL, ZAPX_MASTER_KEY.',
    );
  });
});
