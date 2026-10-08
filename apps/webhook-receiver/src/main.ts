import { buildReceiver } from './app.js';

const port = Number(process.env.ZAPX_WEBHOOK_RECEIVER_PORT ?? 4010);
const secret = process.env.WEBHOOK_SIGNING_SECRET ?? 'local-webhook-secret';
const application = buildReceiver(secret);
await application.listen({ host: '0.0.0.0', port });
