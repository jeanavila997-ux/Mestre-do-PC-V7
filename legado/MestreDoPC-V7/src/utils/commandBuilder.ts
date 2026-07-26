/**
 * PowerShell Command Builder for MestreDoPC V7
 *
 * Constructs safe, encoded PowerShell commands from tool names and parameters.
 * Depends on security/sanitizer for escaping and parameter validation.
 */

import { escapeString, isValidParamName } from '../security/sanitizer';

/**
 * Encodes a command to Base64 for safe execution via -EncodedCommand
 *
 * @param command - The PowerShell command to encode
 * @returns Base64 encoded string (UTF-16LE as required by PowerShell)
 */
export function encodeCommand(command: string): string {
  const buffer = Buffer.from(command, 'utf16le');
  return buffer.toString('base64');
}

/**
 * Builds a safe PowerShell command using -EncodedCommand
 *
 * @param baseCommand - The base PowerShell command
 * @param args - Optional arguments (will be escaped)
 * @returns Full encoded command ready for execution
 */
export function buildSafeCommand(baseCommand: string, args?: Record<string, string>): string {
  let command = baseCommand.trim();

  if (args) {
    const escapedArgs: string[] = [];
    for (const [key, value] of Object.entries(args)) {
      if (!isValidParamName(key)) {
        throw new Error(`Invalid parameter name: ${key}`);
      }
      const escapedValue = escapeString(value);
      escapedArgs.push(`-${key} "${escapedValue}"`);
    }
    command = `${command} ${escapedArgs.join(' ')}`;
  }

  const encoded = encodeCommand(command);
  return `powershell -EncodedCommand ${encoded}`;
}
