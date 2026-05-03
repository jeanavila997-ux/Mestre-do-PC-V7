/**
 * Tool: verificar_disco
 *
 * Verifica a integridade e saúde do disco.
 */

import { BaseTool, ToolResult } from '../base';
import { buildSafeCommand } from '../../../utils/commandBuilder';
import { postCommand, getStatus } from '../../../infra/launcher/client';
import { withRetry } from '../../../infra/launcher/retry';
import { pollUntil } from '../../../infra/launcher/poller';
import { logger } from '../../../infra/logger';

export class VerificarDisco extends BaseTool {
  readonly name = 'verificar_disco';
  readonly description = 'Verifica a integridade e saúde do disco (SMART, espaço, erros)';
  readonly parameters = [
    { name: 'driveLetter', type: 'string' as const, required: true, description: 'Letra da unidade (A-Z)' },
    { name: 'fixErrors', type: 'boolean' as const, required: false, description: 'Tenta corrigir erros automaticamente' },
  ];

  protected async executeImpl(params: Record<string, string>): Promise<ToolResult> {
    const command = buildSafeCommand(this.name, params);
    logger.info({ tool: this.name }, 'Executing launcher command');

    const run = await withRetry(() => postCommand({ command }));

    const result = await pollUntil<{ status: string; result?: unknown; error?: string }>(
      async () => {
        const status = await getStatus({ jobId: run.jobId });
        return { done: status.status !== 'running', result: status };
      },
      { timeoutMs: 300000 }
    );

    if (result.status === 'failed') {
      return { success: false, error: result.error || 'Job failed' };
    }

    return { success: true, data: result.result };
  }
}
