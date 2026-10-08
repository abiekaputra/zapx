import type { Principal } from '@zapx/domain';
import type { FastifyRequest } from 'fastify';

export interface AuthenticatedRequest extends FastifyRequest {
  principal?: Principal;
}
