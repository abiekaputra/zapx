import pino, { type Logger, type LoggerOptions } from 'pino';

const sensitivePaths = [
  'authorization',
  'cookie',
  'password',
  'req.headers.authorization',
  'req.headers.cookie',
  'token',
];

export interface LoggerContext {
  level: string;
  service: string;
}

export function createLogger(context: LoggerContext): Logger {
  const options: LoggerOptions = {
    base: { service: context.service },
    level: context.level,
    redact: {
      censor: '[REDACTED]',
      paths: sensitivePaths,
    },
  };

  return pino(options);
}
