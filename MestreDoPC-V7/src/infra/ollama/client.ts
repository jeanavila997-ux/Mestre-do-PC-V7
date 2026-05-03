/**
 * Ollama Client for MestreDoPC V7
 *
 * Thin wrapper around the local Ollama API for AI-powered analysis.
 */

import { logger } from '../logger';

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    num_predict?: number;
    temperature?: number;
  };
}

export interface OllamaGenerateResponse {
  response: string;
  done: boolean;
  context?: number[];
}

export async function generate(
  request: OllamaGenerateRequest
): Promise<OllamaGenerateResponse> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: request.model,
      prompt: request.prompt,
      stream: false,
      options: request.options,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    throw new Error(`Ollama HTTP ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as OllamaGenerateResponse;
  logger.debug({ model: request.model }, 'Ollama generation completed');
  return data;
}
