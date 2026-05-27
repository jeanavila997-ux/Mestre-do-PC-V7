/**
 * Unit Tests for Poller Utility
 */

import { pollUntil } from '../../src/infra/launcher/poller';

describe('pollUntil', () => {
  it('should return immediately when done', async () => {
    const predicate = jest.fn().mockResolvedValue({ done: true, result: 'done' });
    const result = await pollUntil(predicate, { intervalMs: 10, timeoutMs: 1000 });
    expect(result).toBe('done');
    expect(predicate).toHaveBeenCalledTimes(1);
  });

  it('should poll multiple times until done', async () => {
    const predicate = jest
      .fn()
      .mockResolvedValueOnce({ done: false })
      .mockResolvedValueOnce({ done: false })
      .mockResolvedValue({ done: true, result: 'finally' });

    const result = await pollUntil(predicate, { intervalMs: 10, timeoutMs: 1000 });
    expect(result).toBe('finally');
    expect(predicate).toHaveBeenCalledTimes(3);
  });

  it('should throw on timeout', async () => {
    const predicate = jest.fn().mockResolvedValue({ done: false });

    await expect(
      pollUntil(predicate, { intervalMs: 10, timeoutMs: 50 })
    ).rejects.toThrow('timed out');
  });
});
