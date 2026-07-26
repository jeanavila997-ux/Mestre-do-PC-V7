/**
 * Parameter Whitelist Validator for MestreDoPC V7
 * 
 * Ensures only expected parameters are passed to each tool,
 * preventing unauthorized command modifications.
 */

/**
 * Parameter schema for each tool
 */
export interface ToolParamSchema {
  required: string[];
  optional: string[];
  pattern?: Record<string, RegExp>;
}

/**
 * Whitelist of allowed parameters per tool
 */
export const TOOL_PARAM_WHITELIST: Record<string, ToolParamSchema> = {
  limpeza_rapida_completa: {
    required: [],
    optional: ['confirm', 'dryRun'],
    pattern: {
      confirm: /^(true|false)$/,
      dryRun: /^(true|false)$/,
    },
  },
  liberar_memoria_ram: {
    required: [],
    optional: ['targetMB'],
    pattern: {
      targetMB: /^\d+$/,
    },
  },
  analizar_logs_sistema: {
    required: [],
    optional: ['logName', 'entryType', 'hours'],
    pattern: {
      logName: /^[a-zA-Z0-9\s_-]+$/,
      entryType: /^(Error|Warning|Information)$/,
      hours: /^\d+$/,
    },
  },
  perguntar_ia: {
    required: ['prompt'],
    optional: ['model', 'maxTokens'],
    pattern: {
      prompt: /^[\s\S]{1,2000}$/,
      model: /^[a-zA-Z0-9_-]+$/,
      maxTokens: /^\d+$/,
    },
  },
  verificar_disco: {
    required: ['driveLetter'],
    optional: ['fixErrors'],
    pattern: {
      driveLetter: /^[A-Z]$/,
      fixErrors: /^(true|false)$/,
    },
  },
  reset_windows_update: {
    required: [],
    optional: ['confirm'],
    pattern: {
      confirm: /^(true|false)$/,
    },
  },
};

/**
 * Validates parameters against the whitelist for a given tool
 * 
 * @param toolName - The name of the tool
 * @param params - The parameters to validate
 * @returns Object with isValid boolean and errors array
 * 
 * @example
 * validateToolParams('limpeza_rapida_completa', { dryRun: 'true' })
 * // { isValid: true, errors: [] }
 */
export function validateToolParams(
  toolName: string,
  params: Record<string, string>
): { isValid: boolean; errors: string[] } {
  const schema = TOOL_PARAM_WHITELIST[toolName];

  if (!schema) {
    return {
      isValid: false,
      errors: [`Unknown tool: ${toolName}`],
    };
  }

  const errors: string[] = [];

  // Check required parameters
  for (const requiredParam of schema.required) {
    if (!(requiredParam in params)) {
      errors.push(`Missing required parameter: ${requiredParam}`);
    }
  }

  // Check for unknown parameters
  for (const paramName of Object.keys(params)) {
    if (!schema.required.includes(paramName) && !schema.optional.includes(paramName)) {
      errors.push(`Unknown parameter for ${toolName}: ${paramName}`);
    }
  }

  // Validate parameter patterns
  if (schema.pattern) {
    for (const [paramName, pattern] of Object.entries(schema.pattern)) {
      const value = params[paramName];
      if (value && !pattern.test(value)) {
        errors.push(`Invalid value for ${paramName}: does not match expected pattern`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Gets the list of all available tools
 * 
 * @returns Array of tool names
 */
export function getAvailableTools(): string[] {
  return Object.keys(TOOL_PARAM_WHITELIST);
}

/**
 * Gets the schema for a specific tool
 * 
 * @param toolName - The name of the tool
 * @returns The parameter schema or undefined if tool doesn't exist
 */
export function getToolSchema(toolName: string): ToolParamSchema | undefined {
  return TOOL_PARAM_WHITELIST[toolName];
}
