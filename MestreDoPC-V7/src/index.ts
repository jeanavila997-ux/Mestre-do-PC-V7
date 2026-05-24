/**
 * MestreDoPC V7 - MCP Server
 *
 * Main entry point for the MCP (Model Context Protocol) server
 * that exposes Windows maintenance tools to AI assistants.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { generateCorrelationId, logger } from './logger.js';
import { getAvailableTools, getToolSchema } from './security/whitelist.js';
import { executeLauncherCommand } from './launcher-client.js';

const SERVER_NAME = 'mestredopc-v7';
const SERVER_VERSION = '7.0.0';

async function main() {
  logger.info('Starting MestreDoPC V7 MCP Server...');

  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = getAvailableTools().map((toolName) => {
      const schema = getToolSchema(toolName);
      const properties: Record<string, any> = {};

      if (schema) {
        // Add required parameters to properties
        for (const param of schema.required) {
          properties[param] = {
            type: 'string',
            description: `Required parameter: ${param}${schema.pattern?.[param] ? ` (matches pattern: ${schema.pattern[param].source})` : ''}`,
          };
        }
        // Add optional parameters to properties
        for (const param of schema.optional) {
          properties[param] = {
            type: 'string',
            description: `Optional parameter: ${param}${schema.pattern?.[param] ? ` (matches pattern: ${schema.pattern[param].source})` : ''}`,
          };
        }
      }

      // Keep legacy nested params object as well for backward compatibility
      properties.params = {
        type: 'object',
        description: 'Deprecated: Use flat parameters instead. Legacy nested tool-specific parameters.',
        additionalProperties: true,
      };

      return {
        name: toolName,
        description: `Execute Windows maintenance tool: ${toolName}`,
        inputSchema: {
          type: 'object',
          properties,
          required: schema?.required || [],
        },
      };
    });

    logger.info({ toolCount: tools.length }, 'Listed available tools');
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const correlationId = generateCorrelationId('call');
    const toolLogger = logger.child({ correlationId, toolName: name });
    const startedAt = Date.now();

    toolLogger.info('Executing tool call');

    try {
      // Normalise flat parameters and legacy nested params object
      const rawArgs = (args || {}) as Record<string, any>;
      const nestedParams = (rawArgs.params || {}) as Record<string, any>;
      
      const params: Record<string, string> = {};
      
      // Merge flat arguments
      for (const [key, value] of Object.entries(rawArgs)) {
        if (key !== 'params' && value !== undefined && value !== null) {
          params[key] = String(value);
        }
      }
      
      // Merge nested params (overwriting flat arguments if there's overlap)
      for (const [key, value] of Object.entries(nestedParams)) {
        if (value !== undefined && value !== null) {
          params[key] = String(value);
        }
      }

      const result = await executeLauncherCommand(name, params, correlationId);
      toolLogger.info({ success: true, latencyMs: Date.now() - startedAt }, 'Tool execution completed');
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toolLogger.error({ error: errorMessage, latencyMs: Date.now() - startedAt }, 'Tool execution failed');
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('MCP Server started successfully');
}

process.on('uncaughtException', (error) => {
  logger.error({ error: error.message }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
  process.exit(1);
});

main().catch((error) => {
  logger.error({ error: error.message }, 'Failed to start server');
  process.exit(1);
});
