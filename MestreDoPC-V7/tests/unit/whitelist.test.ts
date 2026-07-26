/**
 * Unit Tests for Parameter Whitelist
 */

import {
  validateToolParams,
  getAvailableTools,
  getToolSchema,
} from '../../src/security/whitelist';

describe('validateToolParams', () => {
  describe('limpeza_rapida_completa', () => {
    it('should accept valid params', () => {
      const result = validateToolParams('limpeza_rapida_completa', {
        dryRun: 'true',
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept empty params', () => {
      const result = validateToolParams('limpeza_rapida_completa', {});
      expect(result.isValid).toBe(true);
    });

    it('should reject unknown params', () => {
      const result = validateToolParams('limpeza_rapida_completa', {
        unknownParam: 'value',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unknown parameter for limpeza_rapida_completa: unknownParam');
    });

    it('should reject invalid dryRun value', () => {
      const result = validateToolParams('limpeza_rapida_completa', {
        dryRun: 'invalid',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid value'))).toBe(true);
    });
  });

  describe('perguntar_ia', () => {
    it('should accept valid params with required prompt', () => {
      const result = validateToolParams('perguntar_ia', {
        prompt: 'What is the weather?',
        model: 'llama2',
      });
      expect(result.isValid).toBe(true);
    });

    it('should reject missing required prompt', () => {
      const result = validateToolParams('perguntar_ia', {
        model: 'llama2',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required parameter: prompt');
    });

    it('should reject prompt that is too long', () => {
      const longPrompt = 'a'.repeat(2001);
      const result = validateToolParams('perguntar_ia', {
        prompt: longPrompt,
      });
      expect(result.isValid).toBe(false);
    });
  });

  describe('verificar_disco', () => {
    it('should accept valid drive letter', () => {
      const result = validateToolParams('verificar_disco', {
        driveLetter: 'C',
      });
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid drive letter', () => {
      const result = validateToolParams('verificar_disco', {
        driveLetter: 'CC',
      });
      expect(result.isValid).toBe(false);
    });

    it('should reject missing required driveLetter', () => {
      const result = validateToolParams('verificar_disco', {});
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required parameter: driveLetter');
    });
  });

  describe('unknown tool', () => {
    it('should reject unknown tool names', () => {
      const result = validateToolParams('unknown_tool', {});
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unknown tool: unknown_tool');
    });
  });
});

describe('getAvailableTools', () => {
  it('should return array of tool names', () => {
    const tools = getAvailableTools();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
    expect(tools).toContain('limpeza_rapida_completa');
    expect(tools).toContain('perguntar_ia');
  });
});

describe('getToolSchema', () => {
  it('should return schema for known tool', () => {
    const schema = getToolSchema('limpeza_rapida_completa');
    expect(schema).toBeDefined();
    expect(schema?.required).toBeDefined();
    expect(schema?.optional).toBeDefined();
  });

  it('should return undefined for unknown tool', () => {
    const schema = getToolSchema('unknown_tool');
    expect(schema).toBeUndefined();
  });
});
