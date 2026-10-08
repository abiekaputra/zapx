import { loadApiEnvironment } from '@zapx/config';
import type { FastifyReply } from 'fastify';

import type { IssuedSession } from './auth.service.js';

const secure = loadApiEnvironment().NODE_ENV === 'production';

export function setSessionCookies(reply: FastifyReply, session: IssuedSession): void {
  reply
    .setCookie('zapx_access', session.accessToken, {
      expires: session.accessExpiresAt,
      httpOnly: true,
      path: '/',
      sameSite: 'strict',
      secure,
    })
    .setCookie('zapx_refresh', session.refreshToken, {
      expires: session.refreshExpiresAt,
      httpOnly: true,
      path: '/v1/auth',
      sameSite: 'strict',
      secure,
    })
    .setCookie('zapx_csrf', session.csrfToken, {
      expires: session.refreshExpiresAt,
      httpOnly: false,
      path: '/',
      sameSite: 'strict',
      secure,
    });
}

export function clearSessionCookies(reply: FastifyReply): void {
  const options = { path: '/', sameSite: 'strict' as const, secure };
  reply
    .clearCookie('zapx_access', options)
    .clearCookie('zapx_refresh', { ...options, path: '/v1/auth' })
    .clearCookie('zapx_csrf', options);
}
