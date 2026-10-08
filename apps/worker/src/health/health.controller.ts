import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@zapx/contracts';

@Controller()
export class HealthController {
  @Get('health')
  public health(): HealthResponse {
    return {
      service: 'zapx-worker',
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    };
  }
}
