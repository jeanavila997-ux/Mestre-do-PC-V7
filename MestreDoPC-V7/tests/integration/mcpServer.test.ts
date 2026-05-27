/**
 * Integration Tests for MCP Server Flow
 *
 * Validates end-to-end tool registration, listing, and execution.
 */

jest.mock('../../src/infra/launcher/client');
jest.mock('../../src/infra/ollama/client');

import { getAllTools, getTool } from '../../src/mcp/tools/registry';
import { handleListTools } from '../../src/mcp/handlers/listTools';
import { handleCallTool } from '../../src/mcp/handlers/callTool';

describe('MCP Server - Integration', () => {
  describe('ListTools', () => {
    it('should return all registered tools with schemas', async () => {
      const result = await handleListTools();
      expect(result.tools.length).toBeGreaterThan(0);
      expect(result.tools[0]).toHaveProperty('name');
      expect(result.tools[0]).toHaveProperty('description');
      expect(result.tools[0]).toHaveProperty('inputSchema');
    });

    it('should include limpeza and IA tools', async () => {
      const result = await handleListTools();
      const names = result.tools.map((t) => t.name);
      expect(names).toContain('limpeza_rapida_completa');
      expect(names).toContain('perguntar_ia');
    });
  });

  describe('CallTool', () => {
    it('should reject unknown tool', async () => {
      const result = await handleCallTool({
        params: { name: 'tool_desconhecida', arguments: { params: {} } },
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown tool');
    });

    it('should validate parameters before execution', async () => {
      const tool = getTool('verificar_disco');
      expect(tool).toBeDefined();

      await expect(tool!.execute({})).rejects.toThrow();
    });

    it('should detect injection in parameters', async () => {
      const tool = getTool('limpeza_rapida_completa');
      expect(tool).toBeDefined();

      await expect(
        tool!.execute({ dryRun: 'true; rm -rf /' })
      ).rejects.toThrow('Security violation');
    });
  });

  describe('Registry', () => {
    it('should retrieve all tool names', () => {
      const tools = getAllTools();
      expect(tools.length).toBe(6);
    });

    it('should retrieve a tool by name', () => {
      const tool = getTool('perguntar_ia');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('perguntar_ia');
    });

    it('should return undefined for unknown tool', () => {
      expect(getTool('nonexistent')).toBeUndefined();
    });
  });
});
