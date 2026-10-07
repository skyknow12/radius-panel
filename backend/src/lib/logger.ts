import pino from 'pino';
import { config } from '../config/env';

export const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: 'radius-panel-backend' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.password_hash',
    ],
    censor: '[redacted]',
  },
});
