import { createHmac, timingSafeEqual } from 'node:crypto';

export function signWebhook(
  secret: string,
  deliveryId: string,
  timestamp: string,
  body: string,
): string {
  const payload = `v1.${timestamp}.${deliveryId}.${body}`;
  return `v1=${createHmac('sha256', secret).update(payload).digest('hex')}`;
}

export function verifyWebhook(
  secret: string,
  deliveryId: string,
  timestamp: string,
  body: string,
  signature: string,
): boolean {
  const expected = Buffer.from(signWebhook(secret, deliveryId, timestamp, body));
  const supplied = Buffer.from(signature);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
