/**
 * Integration Tests for Launcher Infrastructure
 *
 * Validates the HTTP client, retry, and poller modules together.
 */

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

import { postCommand, getStatus } from '../../src/infra/launcher/client';
import { withRetry } from '../../src/infra/launcher/retry';
import { pollUntil } from '../../src/infra/launcher/poller';

describe('Launcher Infrastructure - Integration', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should submit command, retry on 500, then poll to completion', async () => {
    // First call fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    // Retry succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobId: 'job-123', status: 'queued' }),
    });

    // First poll: still running
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'running' }),
    });

    // Second poll: completed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'completed', result: { output: 'done' } }),
    });

    const run = await withRetry(() => postCommand({ command: 'Get-Date' }));
    expect(run.jobId).toBe('job-123');

    const result = await pollUntil(
      async () => {
        const status = await getStatus({ jobId: run.jobId });
        return { done: status.status !== 'running', result: status };
      },
      { intervalMs: 10, timeoutMs: 5000 }
    );

    expect(result.status).toBe('completed');
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('should timeout if job never completes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ jobId: 'job-456', status: 'queued' }),
    });

    const run = await postCommand({ command: 'Slow-Command' });

    await expect(
      pollUntil(
        async () => {
          const status = await getStatus({ jobId: run.jobId });
          return { done: status.status !== 'running', result: status };
        },
        { intervalMs: 10, timeoutMs: 50 }
      )
    ).rejects.toThrow('timed out');
  });
});
