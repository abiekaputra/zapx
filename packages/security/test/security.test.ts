import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  canonicalHash,
  hashSecret,
  PayloadCipher,
  randomToken,
  verifySecret,
} from '../src/index.js';

describe('security primitives', () => {
  it('hashes and verifies secrets without storing plaintext', async () => {
    const encoded = await hashSecret('synthetic-secret');

    expect(encoded).not.toContain('synthetic-secret');
    await expect(verifySecret(encoded, 'synthetic-secret')).resolves.toBe(true);
    await expect(verifySecret(encoded, 'wrong-secret')).resolves.toBe(false);
  });

  it('binds encrypted values to their associated record data', () => {
    const cipher = new PayloadCipher(randomBytes(32));
    const encrypted = cipher.encrypt('recipient@example.test', 'workspace:notification');

    expect(cipher.decrypt(encrypted, 'workspace:notification')).toBe('recipient@example.test');
    expect(() => cipher.decrypt(encrypted, 'another-record')).toThrow();
  });

  it('produces stable hashes for equivalent object key order', () => {
    expect(canonicalHash({ b: 2, a: 1 })).toBe(canonicalHash({ a: 1, b: 2 }));
  });

  it('generates namespaced random tokens', () => {
    expect(randomToken('zx_test_', 16)).toMatch(/^zx_test_[A-Za-z0-9_-]+$/);
  });
});
