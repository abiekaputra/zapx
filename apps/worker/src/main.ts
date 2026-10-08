import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { loadServiceEnvironment } from '@zapx/config';
import { createLogger } from '@zapx/observability';

import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const environment = loadServiceEnvironment(4001, {
    ...process.env,
    PORT: process.env.ZAPX_WORKER_HEALTH_PORT,
  });
  const logger = createLogger({ level: environment.LOG_LEVEL, service: 'zapx-worker' });
  const application = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ loggerInstance: logger }),
  );

  application.enableShutdownHooks();
  await application.listen(environment.PORT, environment.HOST);
}

void bootstrap();
