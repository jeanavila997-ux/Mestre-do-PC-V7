/**
 * Unit Tests for Launcher HTTP Client
 */

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

import { postCommand, getStatus } from '../../src/infra/launcher/client';

describe('launcher client', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('postCommand', () => {
    it('should POST command and return job', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobId: 'j1', status: 'queued' }),
      });

      const result = await postCommand({ command: 'Get-Date' });
      expect(result.jobId).toBe('j1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/run'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should throw on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(postCommand({ command: 'fail' })).rejects.toThrow('HTTP 500');
    });
  });

  describe('getStatus', () => {
    it('should GET status and return response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'completed', result: 'ok' }),
      });

      const result = await getStatus({ jobId: 'j1' });
      expect(result.status).toBe('completed');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('jobId=j1'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should throw on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(getStatus({ jobId: 'missing' })).rejects.toThrow('HTTP 404');
    });
  });
});
