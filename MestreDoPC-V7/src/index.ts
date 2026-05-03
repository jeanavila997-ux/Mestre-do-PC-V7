/**
 * MestreDoPC V7 - MCP Server
 *
 * Main entry point. Boots configuration, logger, and the MCP server.
 */

import { logger } from './infra/logger';
import { createAndStartServer } from './mcp/server';

process.on('uncaughtException', (error) => {
  logger.error({ error: error.message }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
  process.exit(1);
});

createAndStartServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error({ error: message }, 'Failed to start server');
  process.exit(1);
});
