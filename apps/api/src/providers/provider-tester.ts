import { lookup } from 'node:dns/promises';
import { isIP, Socket } from 'node:net';

import type { ProviderConfig } from '@zapx/domain';

export interface ProviderTestResult {
  message: string;
  successful: boolean;
}

export async function testProvider(
  kind: 'SMTP' | 'WEBHOOK',
  config: ProviderConfig,
  allowedHosts: Set<string>,
): Promise<ProviderTestResult> {
  try {
    if (kind === 'SMTP' && 'host' in config) {
      await testTcp(config.host, config.port);
      return { message: 'SMTP endpoint accepted a TCP connection.', successful: true };
    }
    if ('url' in config) {
      const url = new URL(config.url);
      await assertSafeUrl(url, allowedHosts);
      await fetch(url, {
        method: 'OPTIONS',
        redirect: 'manual',
        signal: AbortSignal.timeout(3_000),
      });
      return { message: 'Webhook endpoint returned an HTTP response.', successful: true };
    }
    return { message: 'Provider configuration does not match its channel.', successful: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection test failed.';
    return { message: safeMessage(message), successful: false };
  }
}

async function testTcp(host: string, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = new Socket();
    const finish = (error?: Error) => {
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };
    socket.setTimeout(3_000, () => finish(new Error('Connection timed out.')));
    socket.once('error', () => finish(new Error('SMTP endpoint is unavailable.')));
    socket.connect(port, host, () => finish());
  });
}

async function assertSafeUrl(url: URL, allowedHosts: Set<string>): Promise<void> {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('HTTP or HTTPS is required.');
  const hostname = url.hostname.toLowerCase();
  if (allowedHosts.has(hostname)) return;
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true });
  if (addresses.some(({ address }) => privateAddress(address))) {
    throw new Error('Webhook destination resolves to a restricted network.');
  }
}

function privateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === '::1' || normalized.startsWith('fe80:')) return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  const parts = (normalized.startsWith('::ffff:') ? normalized.slice(7) : normalized)
    .split('.')
    .map(Number);
  if (parts.length !== 4) return false;
  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second! >= 16 && second! <= 31) ||
    (first === 192 && second === 168) ||
    first! >= 224
  );
}

function safeMessage(message: string): string {
  if (/timed out/i.test(message)) return 'Connection timed out.';
  if (/restricted network/i.test(message)) return message;
  return 'The endpoint could not be reached with the supplied configuration.';
}
