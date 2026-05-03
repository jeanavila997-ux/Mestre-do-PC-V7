/**
 * Tool: analizar_logs_sistema
 *
 * Analisa logs do sistema com inteligência artificial.
 */

import { BaseTool, ToolResult } from '../base';
import { buildSafeCommand } from '../../../utils/commandBuilder';
import { postCommand, getStatus } from '../../../infra/launcher/client';
import { withRetry } from '../../../infra/launcher/retry';
import { pollUntil } from '../../../infra/launcher/poller';
import { logger } from '../../../infra/logger';

export class AnalizarLogsSistema extends BaseTool {
  readonly name = 'analizar_logs_sistema';
  readonly description = 'Analisa logs do sistema (Event Viewer) e retorna insights';
  readonly parameters = [
    { name: 'logName', type: 'string' as const, required: false, description: 'Nome do log (ex: System, Application)' },
    { name: 'entryType', type: 'string' as const, required: false, description: 'Tipo de entrada: Error, Warning, Information' },
    { name: 'hours', type: 'integer' as const, required: false, description: 'Quantidade de horas para analisar' },
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
