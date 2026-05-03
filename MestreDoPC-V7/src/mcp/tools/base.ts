/**
 * Base Tool Abstraction for MestreDoPC V7
 *
 * All tools must implement ITool (defined in domain/types).
 * This module provides a convenient abstract base class.
 */

import { ITool, ToolResult, ToolParameter } from '../../domain/types';
import { ValidationError, SecurityError } from '../../domain/errors';
import { validateToolCall } from '../../security/index';

export type { ITool, ToolResult, ToolParameter };

export abstract class BaseTool implements ITool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parameters: ToolParameter[];

  /**
   * Validates and then executes the tool.
   * Override executeImpl() rather than this method.
   */
  async execute(params: Record<string, string>): Promise<ToolResult> {
    const { validation, security } = validateToolCall(this.name, params);

    if (!validation.isValid) {
      throw new ValidationError(
        `Invalid parameters for ${this.name}`,
        validation.errors
      );
    }

    if (!security.safe) {
      throw new SecurityError(
        `Security check failed for ${this.name}`,
        security.violations
      );
    }

    return this.executeImpl(params);
  }

  /**
   * Actual tool implementation. Must be overridden by subclasses.
   */
  protected abstract executeImpl(
    params: Record<string, string>
  ): Promise<ToolResult>;

  /**
   * Helper to build the MCP JSON schema from parameters.
   */
  get inputSchema(): object {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const param of this.parameters) {
      properties[param.name] = {
        type: param.type,
        description: param.description || '',
      };
      if (param.required) {
        required.push(param.name);
      }
    }

    return {
      type: 'object',
      properties,
      required,
    };
  }
}
