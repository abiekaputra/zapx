import fastifyCookie from '@fastify/cookie';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { loadApiEnvironment } from '@zapx/config';
import { createLogger } from '@zapx/observability';

import { AppModule } from './app.module.js';
import { ProblemFilter } from './common/problem.filter.js';

async function bootstrap(): Promise<void> {
  const environment = loadApiEnvironment();
  const logger = createLogger({ level: environment.LOG_LEVEL, service: 'zapx-api' });
  const application = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ loggerInstance: logger }),
  );

  await application.register(fastifyCookie);
  application.enableCors({
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    origin: environment.NODE_ENV === 'production' ? false : ['http://localhost:3000'],
  });
  application
    .getHttpAdapter()
    .getInstance()
    .addHook('onSend', (_request, reply, _payload, done) => {
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('X-Frame-Options', 'DENY');
      reply.header('Referrer-Policy', 'no-referrer');
      reply.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
      done();
    });
  application.enableShutdownHooks();
  application.useGlobalFilters(new ProblemFilter());
  const openApi = new DocumentBuilder()
    .setTitle('ZapX API')
    .setDescription('Local-first notification intake and operations API.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', application, SwaggerModule.createDocument(application, openApi));
  await application.listen(environment.PORT, environment.HOST);
}

void bootstrap();
