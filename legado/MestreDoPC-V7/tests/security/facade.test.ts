/**
 * Unit Tests for Security Facade
 */

import { validateToolCall, detectInjection } from '../../src/security/index';

describe('validateToolCall', () => {
  it('should pass for valid params', () => {
    const result = validateToolCall('limpeza_rapida_completa', { dryRun: 'true' });
    expect(result.validation.isValid).toBe(true);
    expect(result.security.safe).toBe(true);
  });

  it('should fail validation for invalid params', () => {
    const result = validateToolCall('verificar_disco', {});
    expect(result.validation.isValid).toBe(false);
    expect(result.validation.errors.length).toBeGreaterThan(0);
    expect(result.security.safe).toBe(true);
  });

  it('should fail security for injection', () => {
    const result = validateToolCall('limpeza_rapida_completa', {
      dryRun: 'true; rm -rf /',
    });
    expect(result.validation.isValid).toBe(false);
    expect(result.security.safe).toBe(false);
    expect(result.security.violations?.length).toBeGreaterThan(0);
  });

  it('should fail both for unknown tool with injection', () => {
    const result = validateToolCall('unknown_tool', { param: 'value;rm' });
    expect(result.validation.isValid).toBe(false);
    expect(result.security.safe).toBe(false);
  });
});

describe('detectInjection re-export', () => {
  it('should detect injection patterns', () => {
    expect(detectInjection('safe')).toBe(false);
    expect(detectInjection('foo; rm')).toBe(true);
  });
});
