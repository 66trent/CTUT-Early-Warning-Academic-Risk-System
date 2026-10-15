import pino from 'pino';

/**
 * Logger vận hành có level (docs/rules/02). Tự che các trường nhạy cảm (docs/rules/04).
 * Không dùng console.log trong code production.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'email',
      '*.email',
      'password',
      '*.password',
      'content',
      '*.content',
      'token',
      '*.token',
      'authorization',
      '*.authorization',
    ],
    censor: '[ẩn]',
  },
  base: { service: process.env.PROCESS_ROLE ?? 'web' },
});
