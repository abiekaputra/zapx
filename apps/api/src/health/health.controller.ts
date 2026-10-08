import { Controller, Get, Inject } from '@nestjs/common';
import { DatabasePool } from '@zapx/database';
import type { HealthResponse } from '@zapx/contracts';

@Controller()
export class HealthController {
  public constructor(@Inject(DatabasePool) private readonly database: DatabasePool) {}

  @Get('health')
  public health(): HealthResponse {
    return this.response();
  }

  @Get('ready')
  public async ready(): Promise<HealthResponse> {
    return this.response((await this.database.isReady()) ? 'ok' : 'degraded');
  }

  private response(status: HealthResponse['status'] = 'ok'): HealthResponse {
    return {
      service: 'zapx-api',
      status,
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    };
  }
}
