/**
 * Unit Tests for Tool Registry
 */

import { getTool, getAllTools, getToolNames } from '../../src/mcp/tools/registry';

describe('Tool Registry', () => {
  it('should return all 6 tools', () => {
    const tools = getAllTools();
    expect(tools.length).toBe(6);
  });

  it('should contain known tools', () => {
    const names = getToolNames();
    expect(names).toContain('limpeza_rapida_completa');
    expect(names).toContain('perguntar_ia');
    expect(names).toContain('verificar_disco');
  });

  it('should retrieve a tool by name', () => {
    const tool = getTool('limpeza_rapida_completa');
    expect(tool).toBeDefined();
    expect(tool?.name).toBe('limpeza_rapida_completa');
  });

  it('should return undefined for unknown tool', () => {
    expect(getTool('nonexistent')).toBeUndefined();
  });
});
