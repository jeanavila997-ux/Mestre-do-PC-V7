/**
 * ListTools Handler for MestreDoPC V7
 *
 * Responds to MCP ListToolsRequestSchema by enumerating registered tools.
 */

import { getAllTools } from '../tools/registry';
import { logger } from '../../infra/logger';

export function handleListTools(): { tools: { name: string; description: string; inputSchema: object }[] } {
  const tools = getAllTools().map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema || {
      type: 'object',
      properties: {},
    },
  }));

  logger.info({ toolCount: tools.length }, 'Listed available tools');
  return { tools };
}
