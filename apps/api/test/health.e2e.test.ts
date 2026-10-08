import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { healthResponseSchema } from '@zapx/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';

describe('API health', () => {
  let application: NestFastifyApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    application = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await application.init();
    await application.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await application.close();
  });

  it.each(['/health', '/ready'])('returns a valid response from %s', async (url) => {
    const response = await application.inject({ method: 'GET', url });

    expect(response.statusCode).toBe(200);
    expect(healthResponseSchema.parse(response.json()).service).toBe('zapx-api');
  });
});
