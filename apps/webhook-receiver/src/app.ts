import Fastify, { type FastifyInstance } from 'fastify';
import { verifyWebhook } from '@zapx/security';

const replayWindowSeconds = 300;

export function buildReceiver(secret: string): FastifyInstance {
  const application = Fastify({ logger: false });
  const received = new Set<string>();
  application.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_request, body, done) => {
      done(null, body);
    },
  );
  application.get('/health', async () => ({ status: 'ok' }));
  application.post<{ Querystring: { mode?: string } }>('/deliveries', async (request, reply) => {
    const body = typeof request.body === 'string' ? request.body : '';
    const deliveryId = header(request.headers['zapx-delivery-id']);
    const signature = header(request.headers['zapx-signature']);
    const timestamp = header(request.headers['zapx-timestamp']);
    const age = Math.abs(Date.now() / 1_000 - Number(timestamp));
    if (
      !deliveryId ||
      !timestamp ||
      !signature ||
      !Number.isFinite(age) ||
      age > replayWindowSeconds ||
      !verifyWebhook(secret, deliveryId, timestamp, body, signature)
    ) {
      return reply.code(401).send({ code: 'INVALID_SIGNATURE' });
    }
    if (request.query.mode === 'transient') {
      return reply.code(503).send({ code: 'SIMULATED_TRANSIENT_FAILURE' });
    }
    if (request.query.mode === 'permanent') {
      return reply.code(422).send({ code: 'SIMULATED_PERMANENT_FAILURE' });
    }
    const duplicate = received.has(deliveryId);
    received.add(deliveryId);
    return reply.code(duplicate ? 200 : 202).send({ duplicate, received: JSON.parse(body) });
  });
  return application;
}

function header(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
