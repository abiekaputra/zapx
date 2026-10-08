import { describe, expect, it } from 'vitest';

import { loadBaseEnvironment, loadServiceEnvironment } from '../src/index.js';

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
});
