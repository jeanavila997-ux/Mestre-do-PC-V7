/**
 * Unit Tests for Domain Errors
 */

import { AppError, ValidationError, SecurityError, LauncherError } from '../../src/domain/errors';

describe('AppError', () => {
  it('should create error with code and status', () => {
    const err = new AppError('Something failed', 'ERR_TEST', 400);
    expect(err.message).toBe('Something failed');
    expect(err.code).toBe('ERR_TEST');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('AppError');
  });
});

describe('ValidationError', () => {
  it('should default to VALIDATION_ERROR code', () => {
    const err = new ValidationError('Invalid input', ['field required']);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
    expect(err.errors).toEqual(['field required']);
  });
});

describe('SecurityError', () => {
  it('should default to SECURITY_VIOLATION code', () => {
    const err = new SecurityError('Injection detected', ['bad param']);
    expect(err.code).toBe('SECURITY_VIOLATION');
    expect(err.statusCode).toBe(403);
    expect(err.violations).toEqual(['bad param']);
  });
});

describe('LauncherError', () => {
  it('should default to LAUNCHER_ERROR code', () => {
    const original = new Error('Connection refused');
    const err = new LauncherError('Launcher failed', original);
    expect(err.code).toBe('LAUNCHER_ERROR');
    expect(err.statusCode).toBe(502);
    expect(err.originalError).toBe(original);
  });
});
