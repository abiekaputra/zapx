import { createHash } from 'node:crypto';

const retryDelays = [5_000, 30_000] as const;

export class RetryableDeliveryError extends Error {
  public constructor(public readonly delayMs: number) {
    super('Delivery will be retried.');
  }
}

export function retryDelay(attemptNumber: number, notificationId: string): number | null {
  const base = retryDelays[attemptNumber - 1];
  if (!base) return null;
  const sample = createHash('sha256')
    .update(`${notificationId}:${attemptNumber}`)
    .digest()
    .readUInt16BE();
  const jitter = Math.floor((sample / 65_535) * base * 0.2);
  return base + jitter;
}
