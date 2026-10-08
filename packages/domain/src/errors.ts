export type ErrorCode =
  | 'AUTHENTICATION_FAILED'
  | 'FORBIDDEN'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID_STATE'
  | 'NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'VALIDATION_FAILED';

export class DomainError extends Error {
  public constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
