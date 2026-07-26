/**
 * Generic Poller for MestreDoPC V7
 *
 * Polls an async predicate until it returns true or timeout is reached.
 */

import { logger } from '../logger';

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  onTick?: (elapsedMs: number) => void;
}

export async function pollUntil<T>(
  predicate: () => Promise<{ done: boolean; result?: T }>,
  options: PollOptions = {}
): Promise<T> {
  const intervalMs = options.intervalMs ?? 1000;
  const timeoutMs = options.timeoutMs ?? 30000;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const check = await predicate();

      if (check.done) {
        return check.result as T;
      }

      options.onTick?.(Date.now() - startTime);
    } catch (error) {
      logger.warn({ error: (error as Error).message }, 'Polling predicate error');
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Polling timed out after ${timeoutMs}ms`);
}
