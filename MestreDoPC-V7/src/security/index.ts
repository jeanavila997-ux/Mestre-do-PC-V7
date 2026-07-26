/**
 * Security Facade for MestreDoPC V7
 *
 * Single entry point for all security operations.
 * Orchestrates sanitization, whitelist validation, and injection detection.
 */

import { ValidationResult, SecurityCheckResult } from '../domain/types';
import { detectInjection } from './sanitizer';
import { validateToolParams, getAvailableTools, getToolSchema } from './whitelist';

export { detectInjection, validateToolParams, getAvailableTools, getToolSchema };

/**
 * Full security validation for a tool call.
 *
 * @param toolName - The tool being invoked
 * @param params - The parameters provided
 * @returns Combined validation and security check result
 */
export function validateToolCall(
  toolName: string,
  params: Record<string, string>
): { validation: ValidationResult; security: SecurityCheckResult } {
  const validation = validateToolParams(toolName, params);

  const violations: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (detectInjection(value)) {
      violations.push(`Potential injection in parameter '${key}'`);
    }
  }

  const security: SecurityCheckResult = {
    safe: violations.length === 0,
    violations: violations.length > 0 ? violations : undefined,
  };

  return { validation, security };
}
