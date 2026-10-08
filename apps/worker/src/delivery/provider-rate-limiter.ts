import { Injectable } from '@nestjs/common';

@Injectable()
export class ProviderRateLimiter {
  private readonly timestamps = new Map<string, number[]>();

  public async acquire(providerId: string, maximumPerSecond: number): Promise<void> {
    const maximum = Math.max(1, Math.min(maximumPerSecond, 100));
    while (true) {
      const now = Date.now();
      const active = (this.timestamps.get(providerId) ?? []).filter((time) => time > now - 1_000);
      if (active.length < maximum) {
        active.push(now);
        this.timestamps.set(providerId, active);
        return;
      }
      const delay = Math.max(1, active[0]! + 1_000 - now);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
