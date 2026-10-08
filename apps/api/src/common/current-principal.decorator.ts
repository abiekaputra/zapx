import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Principal } from '@zapx/domain';

import type { AuthenticatedRequest } from './authenticated-request.js';

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.principal) throw new Error('Authenticated principal is missing.');
    return request.principal;
  },
);
