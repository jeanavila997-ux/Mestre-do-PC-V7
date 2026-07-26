/**
 * Unit Tests for MCP Handlers
 */

jest.mock('../../src/mcp/tools/registry', () => ({
  getTool: jest.fn(),
  getAllTools: jest.fn(),
}));

import { getTool, getAllTools } from '../../src/mcp/tools/registry';
import { handleListTools } from '../../src/mcp/handlers/listTools';
import { handleCallTool } from '../../src/mcp/handlers/callTool';

const mockGetTool = getTool as jest.MockedFunction<typeof getTool>;
const mockGetAllTools = getAllTools as jest.MockedFunction<typeof getAllTools>;

describe('handleListTools', () => {
  it('should return list of tools', async () => {
    mockGetAllTools.mockReturnValue([
      { name: 't1', description: 'desc1', parameters: [], execute: jest.fn(), inputSchema: {} },
    ] as any);

    const result = await handleListTools();
    expect(result.tools.length).toBe(1);
    expect(result.tools[0].name).toBe('t1');
  });
});

describe('handleCallTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute known tool and return content', async () => {
    const execute = jest.fn().mockResolvedValue({ success: true, data: 'ok' });
    mockGetTool.mockReturnValue({
      name: 't1',
      description: 'd1',
      parameters: [],
      execute,
      inputSchema: {},
    } as any);

    const result = await handleCallTool({
      params: { name: 't1', arguments: { params: {} } },
    });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('ok');
  });

  it('should return error for unknown tool', async () => {
    mockGetTool.mockReturnValue(undefined);

    const result = await handleCallTool({
      params: { name: 'unknown', arguments: {} },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown tool');
  });

  it('should return error when tool throws', async () => {
    const execute = jest.fn().mockRejectedValue(new Error('boom'));
    mockGetTool.mockReturnValue({
      name: 't1',
      description: 'd1',
      parameters: [],
      execute,
      inputSchema: {},
    } as any);

    const result = await handleCallTool({
      params: { name: 't1', arguments: { params: {} } },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('boom');
  });
});
