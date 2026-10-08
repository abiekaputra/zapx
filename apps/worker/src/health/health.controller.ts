import { Controller, Get, Inject } from '@nestjs/common';
import type { HealthResponse } from '@zapx/contracts';

import { DeliveryRuntime } from '../runtime/delivery.runtime.js';

@Controller()
export class HealthController {
  public constructor(@Inject(DeliveryRuntime) private readonly runtime: DeliveryRuntime) {}

  @Get('health')
  public health(): HealthResponse {
    return {
      service: 'zapx-worker',
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    };
  }

  @Get('ready')
  public async ready(): Promise<{ status: 'ready' | 'unavailable' }> {
    return { status: (await this.runtime.isReady()) ? 'ready' : 'unavailable' };
  }
}
