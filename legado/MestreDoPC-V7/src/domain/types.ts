/**
 * Domain Types for MestreDoPC V7
 *
 * Core interfaces and type definitions shared across layers.
 * No framework-specific imports allowed here.
 */

/** Represents a single tool parameter schema */
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'integer';
  required?: boolean;
  description?: string;
  pattern?: RegExp;
  min?: number;
  max?: number;
}

/** Result returned by any tool execution */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  simulated?: boolean;
}

/** Response from the launcher /run endpoint */
export interface LauncherRunResponse {
  jobId: string;
  status: string;
}

/** Response from the launcher /run-status endpoint */
export interface LauncherStatusResponse {
  status: 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
}

/** Contract for all tool implementations */
export interface ITool {
  readonly name: string;
  readonly description: string;
  readonly parameters: ToolParameter[];
  readonly inputSchema: object;
  execute(params: Record<string, string>): Promise<ToolResult>;
}

/** Validation result for tool parameters */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/** Security check result */
export interface SecurityCheckResult {
  safe: boolean;
  violations?: string[];
}
