import { Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { DomainError } from '@zapx/domain';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';
import { ZodError } from 'zod';

@Catch()
export class ProblemFilter implements ExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    const request = host.switchToHttp().getRequest<FastifyRequest>();
    const traceId = this.traceId(request);

    if (exception instanceof DomainError) {
      void response
        .status(exception.status)
        .type('application/problem+json')
        .send({
          code: exception.code,
          details: exception.details,
          status: exception.status,
          title: exception.message,
          trace_id: traceId,
          type: `https://zapx.local/problems/${exception.code.toLowerCase()}`,
        });
      return;
    }

    if (exception instanceof ZodError) {
      void response
        .status(422)
        .type('application/problem+json')
        .send({
          code: 'VALIDATION_FAILED',
          errors: exception.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
          status: 422,
          title: 'The request could not be validated',
          trace_id: traceId,
          type: 'https://zapx.local/problems/validation',
        });
      return;
    }

    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    void response
      .status(status)
      .type('application/problem+json')
      .send({
        code: status === 500 ? 'INTERNAL_ERROR' : 'HTTP_ERROR',
        status,
        title: status === 500 ? 'An internal error occurred' : 'The request was rejected',
        trace_id: traceId,
        type: 'https://zapx.local/problems/http',
      });
  }

  private traceId(request: FastifyRequest): string {
    const header = request.headers['x-request-id'];
    return typeof header === 'string' && header.length <= 128
      ? header
      : randomBytes(16).toString('hex');
  }
}
