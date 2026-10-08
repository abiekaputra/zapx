import { HttpException, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

interface Bucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const policy = this.policy(request.method, request.url);
    if (!policy) return true;
    const now = Date.now();
    const key = `${request.ip}:${request.method}:${request.url.split('?')[0]}`;
    const existing = this.buckets.get(key);
    const bucket =
      !existing || existing.resetAt <= now ? { count: 0, resetAt: now + 60_000 } : existing;
    bucket.count += 1;
    this.buckets.set(key, bucket);
    if (bucket.count > policy) {
      throw new HttpException('Too many requests. Try again shortly.', 429);
    }
    if (this.buckets.size > 1_000) this.removeExpired(now);
    return true;
  }

  private policy(method: string, url: string): number | null {
    const path = url.split('?')[0];
    if (method === 'POST' && path === '/v1/auth/login') return 10;
    if (method === 'POST' && path === '/v1/notifications') return 120;
    return null;
  }

  private removeExpired(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
