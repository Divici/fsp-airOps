// ---------------------------------------------------------------------------
// Error Types — structured error hierarchy for the application
// ---------------------------------------------------------------------------

/**
 * Error codes used throughout the application.
 */
export const ErrorCodes = {
  // General
  UNKNOWN: "UNKNOWN",
  VALIDATION_ERROR: "VALIDATION_ERROR",

  // FSP API
  FSP_API_ERROR: "FSP_API_ERROR",
  FSP_AUTH_ERROR: "FSP_AUTH_ERROR",
  FSP_RATE_LIMITED: "FSP_RATE_LIMITED",
  FSP_NOT_FOUND: "FSP_NOT_FOUND",

  // Workflow
  WORKFLOW_ERROR: "WORKFLOW_ERROR",
  WORKFLOW_NOT_FOUND: "WORKFLOW_NOT_FOUND",
  WORKFLOW_TIMEOUT: "WORKFLOW_TIMEOUT",

  // Tenant
  TENANT_ERROR: "TENANT_ERROR",
  TENANT_NOT_FOUND: "TENANT_NOT_FOUND",
  TENANT_UNAUTHORIZED: "TENANT_UNAUTHORIZED",

  // Proposal
  PROPOSAL_ERROR: "PROPOSAL_ERROR",
  PROPOSAL_NOT_FOUND: "PROPOSAL_NOT_FOUND",
  PROPOSAL_EXPIRED: "PROPOSAL_EXPIRED",
  PROPOSAL_ALREADY_DECIDED: "PROPOSAL_ALREADY_DECIDED",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Base application error. All custom errors extend this.
 * isOperational = true means it is an expected/handled error (not a bug).
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    options?: {
      code?: ErrorCode;
      statusCode?: number;
      isOperational?: boolean;
      cause?: unknown;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = options?.code ?? ErrorCodes.UNKNOWN;
    this.statusCode = options?.statusCode ?? 500;
    this.isOperational = options?.isOperational ?? true;
  }
}

/**
 * Errors from the FSP API layer.
 */
export class FspApiError extends AppError {
  constructor(
    message: string,
    options?: {
      code?: ErrorCode;
      statusCode?: number;
      cause?: unknown;
    }
  ) {
    super(message, {
      code: options?.code ?? ErrorCodes.FSP_API_ERROR,
      statusCode: options?.statusCode ?? 502,
      isOperational: true,
      cause: options?.cause,
    });
    this.name = "FspApiError";
  }
}

/**
 * Errors from workflow execution.
 */
export class WorkflowError extends AppError {
  constructor(
    message: string,
    options?: {
      code?: ErrorCode;
      statusCode?: number;
      cause?: unknown;
    }
  ) {
    super(message, {
      code: options?.code ?? ErrorCodes.WORKFLOW_ERROR,
      statusCode: options?.statusCode ?? 500,
      isOperational: true,
      cause: options?.cause,
    });
    this.name = "WorkflowError";
  }
}

/**
 * Input validation errors.
 */
export class ValidationError extends AppError {
  public readonly fields?: Record<string, string>;

  constructor(
    message: string,
    options?: {
      fields?: Record<string, string>;
      cause?: unknown;
    }
  ) {
    super(message, {
      code: ErrorCodes.VALIDATION_ERROR,
      statusCode: 400,
      isOperational: true,
      cause: options?.cause,
    });
    this.name = "ValidationError";
    this.fields = options?.fields;
  }
}

/**
 * Tenant resolution / authorization errors.
 */
export class TenantError extends AppError {
  constructor(
    message: string,
    options?: {
      code?: ErrorCode;
      statusCode?: number;
      cause?: unknown;
    }
  ) {
    super(message, {
      code: options?.code ?? ErrorCodes.TENANT_ERROR,
      statusCode: options?.statusCode ?? 401,
      isOperational: true,
      cause: options?.cause,
    });
    this.name = "TenantError";
  }
}

/**
 * Proposal-specific errors.
 */
export class ProposalError extends AppError {
  constructor(
    message: string,
    options?: {
      code?: ErrorCode;
      statusCode?: number;
      cause?: unknown;
    }
  ) {
    super(message, {
      code: options?.code ?? ErrorCodes.PROPOSAL_ERROR,
      statusCode: options?.statusCode ?? 400,
      isOperational: true,
      cause: options?.cause,
    });
    this.name = "ProposalError";
  }
}
