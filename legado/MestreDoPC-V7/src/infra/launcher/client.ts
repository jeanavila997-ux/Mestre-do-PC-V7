/**
 * Pure HTTP Client for MestreDoPC Launcher
 *
 * No retry, no polling, no business logic — just raw HTTP calls.
 */

import { LauncherRunResponse, LauncherStatusResponse } from '../../domain/types';
import { config } from '../../config/index';

export interface PostCommandOptions {
  command: string;
  timeoutMs?: number;
}

export interface GetStatusOptions {
  jobId: string;
  timeoutMs?: number;
}

export async function postCommand(
  options: PostCommandOptions
): Promise<LauncherRunResponse> {
  const { command, timeoutMs = 10000 } = options;

  const response = await fetch(`${config.launcher.baseUrl}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<LauncherRunResponse>;
}

export async function getStatus(
  options: GetStatusOptions
): Promise<LauncherStatusResponse> {
  const { jobId, timeoutMs = 5000 } = options;

  const response = await fetch(`${config.launcher.baseUrl}/run-status?jobId=${jobId}`, {
    method: 'GET',
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<LauncherStatusResponse>;
}
