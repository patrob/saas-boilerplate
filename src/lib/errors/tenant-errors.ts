/**
 * Custom error classes for tenant operations
 */

export class TenantBusinessRuleError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = "TenantBusinessRuleError";

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TenantBusinessRuleError);
    }
  }
}

export class TenantValidationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = "TenantValidationError";

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TenantValidationError);
    }
  }
}

export class TenantNotFoundError extends Error {
  constructor(message: string = "Tenant not found") {
    super(message);
    this.name = "TenantNotFoundError";

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TenantNotFoundError);
    }
  }
}

export class TenantUserNotFoundError extends Error {
  constructor(message: string = "User not found in tenant") {
    super(message);
    this.name = "TenantUserNotFoundError";

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TenantUserNotFoundError);
    }
  }
}

export class TenantPermissionError extends Error {
  constructor(message: string = "Insufficient permissions for this operation") {
    super(message);
    this.name = "TenantPermissionError";

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TenantPermissionError);
    }
  }
}

export class TenantContextError extends Error {
  constructor(message: string = "Tenant context not set") {
    super(message);
    this.name = "TenantContextError";

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TenantContextError);
    }
  }
}

// Helper function to check if error is a tenant-related error
export function isTenantError(
  error: unknown
): error is
  | TenantBusinessRuleError
  | TenantValidationError
  | TenantNotFoundError
  | TenantUserNotFoundError
  | TenantPermissionError
  | TenantContextError {
  return (
    error instanceof TenantBusinessRuleError ||
    error instanceof TenantValidationError ||
    error instanceof TenantNotFoundError ||
    error instanceof TenantUserNotFoundError ||
    error instanceof TenantPermissionError ||
    error instanceof TenantContextError
  );
}

// Helper function to get appropriate HTTP status code for tenant errors
export function getTenantErrorStatusCode(error: unknown): number {
  if (error instanceof TenantValidationError) {
    return 400; // Bad Request
  }
  if (
    error instanceof TenantNotFoundError ||
    error instanceof TenantUserNotFoundError
  ) {
    return 404; // Not Found
  }
  if (error instanceof TenantPermissionError) {
    return 403; // Forbidden
  }
  if (error instanceof TenantBusinessRuleError) {
    return 409; // Conflict
  }
  if (error instanceof TenantContextError) {
    return 500; // Internal Server Error
  }
  return 500; // Default to internal server error
}

