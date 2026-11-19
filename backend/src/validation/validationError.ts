// backend/src/validation/validationError.ts
import type { ApiErrorResponse } from '../types/api';

export class ValidationError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly fields: Record<string, string>;

  constructor(
    message: string = 'Please review the highlighted fields.',
    fields: Record<string, string> = {},
    code: string = 'VALIDATION_ERROR',
    status: number = 422
  ) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.status = status;
    this.fields = fields;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }

  public toJSON(requestId?: string): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        fields: this.fields,
        ...(requestId ? { requestId } : {}),
      },
    };
  }
}

export function isValidationError(err: unknown): err is ValidationError {
  return err instanceof ValidationError || (err instanceof Error && err.name === 'ValidationError');
}
