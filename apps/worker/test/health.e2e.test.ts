import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { healthResponseSchema } from '@zapx/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HealthController } from '../src/health/health.controller.js';
import { DeliveryRuntime } from '../src/runtime/delivery.runtime.js';

describe('worker health', () => {
  let application: NestFastifyApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DeliveryRuntime, useValue: { isReady: () => Promise.resolve(true) } }],
    }).compile();
    application = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await application.init();
    await application.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await application.close();
  });

  it('exposes the worker process health', async () => {
    const response = await application.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(healthResponseSchema.parse(response.json()).service).toBe('zapx-worker');
  });

  it('reports delivery dependency readiness', async () => {
    const response = await application.inject({ method: 'GET', url: '/ready' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ready' });
  });
});
