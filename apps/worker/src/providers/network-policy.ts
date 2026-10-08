import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class UnsafeDestinationError extends Error {}

export async function assertSafeDestination(url: URL, allowedHosts: Set<string>): Promise<void> {
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new UnsafeDestinationError('Webhook URL must use HTTP or HTTPS.');
  }
  const hostname = url.hostname.toLowerCase();
  if (allowedHosts.has(hostname)) return;

  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new UnsafeDestinationError('Webhook destination resolves to a restricted network.');
  }
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === '::1' || normalized === '::' || normalized.startsWith('fe80:')) return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  const mapped = normalized.startsWith('::ffff:') ? normalized.slice(7) : normalized;
  const octets = mapped.split('.').map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value))) return false;
  const [first, second] = octets as [number, number, number, number];
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}
