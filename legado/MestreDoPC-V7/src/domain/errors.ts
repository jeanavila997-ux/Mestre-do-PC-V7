/**
 * Domain Errors for MestreDoPC V7
 *
 * Custom error classes for clear error handling across layers.
 */

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public readonly errors: string[] = []) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class SecurityError extends AppError {
  constructor(message: string, public readonly violations?: string[]) {
    super(message, 'SECURITY_VIOLATION', 403);
  }
}

export class LauncherError extends AppError {
  constructor(
    message: string,
    public readonly originalError?: Error
  ) {
    super(message, 'LAUNCHER_ERROR', 502);
  }
}
