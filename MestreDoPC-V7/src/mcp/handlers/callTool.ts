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
    const params = (args as Record<string, string> | undefined)?.params || {};
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
