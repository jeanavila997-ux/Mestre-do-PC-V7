/**
 * Tool: liberar_memoria_ram
 *
 * Libera memória RAM do sistema.
 */

import { BaseTool, ToolResult } from '../base';
import { buildSafeCommand } from '../../../utils/commandBuilder';
import { postCommand, getStatus } from '../../../infra/launcher/client';
import { withRetry } from '../../../infra/launcher/retry';
import { pollUntil } from '../../../infra/launcher/poller';
import { logger } from '../../../infra/logger';

export class LiberarMemoriaRam extends BaseTool {
  readonly name = 'liberar_memoria_ram';
  readonly description = 'Libera memória RAM do sistema, opcionalmente definindo um target em MB';
  readonly parameters = [
    { name: 'targetMB', type: 'integer' as const, required: false, description: 'Quantidade de memória alvo em MB' },
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
      { timeoutMs: 30000 }
    );

    if (result.status === 'failed') {
      return { success: false, error: result.error || 'Job failed' };
    }

    return { success: true, data: result.result };
  }
}
