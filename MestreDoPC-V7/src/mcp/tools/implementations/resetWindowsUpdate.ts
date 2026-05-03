/**
 * Tool: reset_windows_update
 *
 * Reseta o serviço Windows Update.
 */

import { BaseTool, ToolResult } from '../base';
import { buildSafeCommand } from '../../../utils/commandBuilder';
import { postCommand, getStatus } from '../../../infra/launcher/client';
import { withRetry } from '../../../infra/launcher/retry';
import { pollUntil } from '../../../infra/launcher/poller';
import { logger } from '../../../infra/logger';

export class ResetWindowsUpdate extends BaseTool {
  readonly name = 'reset_windows_update';
  readonly description = 'Reseta os componentes do Windows Update';
  readonly parameters = [
    { name: 'confirm', type: 'boolean' as const, required: false, description: 'Confirma a execução' },
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
      { timeoutMs: 120000 }
    );

    if (result.status === 'failed') {
      return { success: false, error: result.error || 'Job failed' };
    }

    return { success: true, data: result.result };
  }
}
