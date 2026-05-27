/**
 * CallTool Handler for MestreDoPC V7
 *
 * Responds to MCP CallToolRequestSchema by dispatching to registered tools.
 */

import { getTool } from '../tools/registry';
import { logger } from '../../infra/logger';

import { CallToolRequest } from '@modelcontextprotocol/sdk/types';

export async function handleCallTool(request: CallToolRequest): Promise<{ content: { type: string; text: string }[]; isError: boolean }> {
  const { name, arguments: args } = request.params;
  const requestId = `call-${Date.now()}`;
  const toolLogger = logger.child({ requestId, toolName: name });

  toolLogger.info('Executing tool call');

  const tool = getTool(name);
  if (!tool) {
    toolLogger.error('Unknown tool requested');
    return {
      content: [{ type: 'text', text: `Error: Unknown tool '${name}'` }],
      isError: true,
    };
  }

  try {
    const rawArgs = (args && typeof args === 'object') ? (args as Record<string, unknown>) : {};
    const rawParams =
      'params' in rawArgs && rawArgs.params && typeof rawArgs.params === 'object'
        ? (rawArgs.params as Record<string, unknown>)
        : rawArgs;

    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawParams)) {
      if (value !== undefined && value !== null) {
        params[key] = String(value);
      }
    }

    const result = await tool.execute(params);

    toolLogger.info({ success: result.success }, 'Tool execution completed');
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      isError: !result.success,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    toolLogger.error({ error: errorMessage }, 'Tool execution failed');
    return {
      content: [{ type: 'text', text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
}
