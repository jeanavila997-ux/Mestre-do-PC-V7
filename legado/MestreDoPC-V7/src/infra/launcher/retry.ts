/**
 * Generic Retry Utility for MestreDoPC V7
 *
 * Pure logic, no side effects. Can wrap any async function.
 */

import { config } from '../../config/index';
import { logger } from '../logger';

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? config.launcher.maxRetries;
  const baseDelayMs = options.baseDelayMs ?? config.launcher.retryDelayMs;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(
        { attempt, maxRetries, error: lastError.message },
        'Retry attempt failed'
      );

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
      }
    }
  }

  throw lastError || new Error('Failed after all retries');
}
