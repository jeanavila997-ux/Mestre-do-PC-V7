/**
 * Unit Tests for Retry Utility
 */

import { withRetry } from '../../src/infra/launcher/retry';

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and then succeed', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after exhausting retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fails'));

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 10 })
    ).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
