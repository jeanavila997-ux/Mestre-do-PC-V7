/**
 * Structured Logger for MestreDoPC V7
 *
 * Uses Pino for high-performance structured logging with
 * timestamps, levels, and request tracking.
 */

import pino from 'pino';
import { config } from '../config/index';

const loggerOptions: pino.LoggerOptions = {
  level: config.log.level,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
  },
  base: {
    service: config.server.name,
    version: config.server.version,
  },
};

export function createLogger(requestId?: string): pino.Logger {
  const baseLogger = pino(loggerOptions);

  if (requestId) {
    return baseLogger.child({ requestId });
  }

  return baseLogger;
}

export const logger = createLogger();
