import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@zapx/contracts';

@Controller()
export class HealthController {
  @Get('health')
  public health(): HealthResponse {
    return this.response();
  }

  @Get('ready')
  public ready(): HealthResponse {
    return this.response();
  }

  private response(): HealthResponse {
    return {
      service: 'zapx-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    };
  }
}
