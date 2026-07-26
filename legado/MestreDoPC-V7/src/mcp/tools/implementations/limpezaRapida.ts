/**
 * Tool: limpeza_rapida_completa
 *
 * Executa uma limpeza rápida e completa do sistema.
 */

import { BaseTool, ToolResult } from '../base';
import { buildSafeCommand } from '../../../utils/commandBuilder';
import { postCommand } from '../../../infra/launcher/client';
import { withRetry } from '../../../infra/launcher/retry';
import { pollUntil } from '../../../infra/launcher/poller';
import { getStatus } from '../../../infra/launcher/client';
import { logger } from '../../../infra/logger';

export class LimpezaRapidaCompleta extends BaseTool {
  readonly name = 'limpeza_rapida_completa';
  readonly description = 'Executa uma limpeza rápida e completa do sistema (TEMP, lixeira, cache WU, prefetch, DNS, logs de eventos)';
  readonly parameters = [
    { name: 'confirm', type: 'boolean' as const, required: false, description: 'Confirma a execução' },
    { name: 'dryRun', type: 'boolean' as const, required: false, description: 'Simula a execução sem alterar o sistema' },
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
      { timeoutMs: 60000 }
    );

    if (result.status === 'failed') {
      return { success: false, error: result.error || 'Job failed' };
    }

    return { success: true, data: result.result };
  }
}
