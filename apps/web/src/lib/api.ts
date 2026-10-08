export class ApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('content-type', 'application/json');
  if (init.method && !['GET', 'HEAD'].includes(init.method)) {
    const csrf = cookie('zapx_csrf');
    if (csrf) headers.set('x-csrf-token', csrf);
  }
  const response = await fetch(path, { ...init, credentials: 'include', headers });
  if (response.status === 401 && retry && path !== '/v1/auth/login') {
    const refreshed = await fetch('/v1/auth/refresh', {
      body: '{}',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    if (refreshed.ok) return api<T>(path, init, false);
  }
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as {
      details?: unknown;
      title?: string;
    };
    throw new ApiError(
      problem.title ?? 'The request could not be completed.',
      response.status,
      problem.details,
    );
  }
  return (await response.json()) as T;
}

export function jsonBody(value: unknown): Pick<RequestInit, 'body' | 'method'> {
  return { body: JSON.stringify(value), method: 'POST' };
}

function cookie(name: string): string | null {
  const prefix = `${name}=`;
  const part = document.cookie.split('; ').find((value) => value.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : null;
}
