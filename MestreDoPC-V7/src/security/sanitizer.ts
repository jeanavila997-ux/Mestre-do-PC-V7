/**
 * Command Sanitizer for MestreDoPC V7
 *
 * Prevents command injection by escaping dangerous characters
 * and validating PowerShell parameters.
 *
 * Note: buildSafeCommand and encodeCommand have moved to utils/commandBuilder.ts.
 */

import { buildSafeCommand, encodeCommand } from '../utils/commandBuilder';

export { buildSafeCommand, encodeCommand };

/**
 * Characters that need escaping in PowerShell commands
 * Note: backtick is NOT included as it's the escape character itself
 */
const DANGEROUS_CHARS = [';', '&', '|', '>', '<', '$', '"', "'", '(', ')', '{', '}', '[', ']', '*', '?', '@'];

/**
 * Escapes dangerous characters in a string to prevent command injection
 *
 * @param input - The string to sanitize
 * @returns Sanitized string with escaped characters
 */
export function escapeString(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  let result = input;
  for (const char of DANGEROUS_CHARS) {
    result = result.replace(new RegExp(`\\${char}`, 'g'), `\`${char}`);
  }

  return result;
}

/**
 * Validates that a parameter name matches allowed pattern
 *
 * @param paramName - The parameter name to validate
 * @returns true if valid, false otherwise
 */
export function isValidParamName(paramName: string): boolean {
  const paramPattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;
  return paramPattern.test(paramName);
}

/**
 * Detects potential command injection attempts
 *
 * @param input - The string to analyze
 * @returns true if injection is detected, false otherwise
 */
export function detectInjection(input: string): boolean {
  const injectionPatterns = [
    /[;&|]/, // Command separators
    /[<>]/, // Redirection
    /\$\(/, // Command substitution
    /`[^`]/, // Escaped characters
    /\b(rm|del|remove|format|partition)\b/i, // Destructive commands
  ];

  return injectionPatterns.some(pattern => pattern.test(input));
}
