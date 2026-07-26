/**
 * MCP Server Bootstrap for MestreDoPC V7
 *
 * Initializes the MCP server and wires handlers.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types';
import { config } from '../config/index';
import { logger } from '../infra/logger';
import { handleListTools } from './handlers/listTools';
import { handleCallTool } from './handlers/callTool';

export async function createAndStartServer(): Promise<void> {
  logger.info('Starting MestreDoPC V7 MCP Server...');

  const server = new Server(
    {
      name: config.server.name,
      version: config.server.version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, handleListTools);
  server.setRequestHandler(CallToolRequestSchema, handleCallTool);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('MCP Server started successfully');
}
