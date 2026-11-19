// backend/src/utils/errors.ts
import type { ApiErrorResponse } from '../types/api';

export class ApplicationError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly fields?: Record<string, string>;

  constructor(
    message: string,
    code: string = 'SERVER_ERROR',
    status: number = 500,
    fields?: Record<string, string>
  ) {
    super(message);
    this.name = 'ApplicationError';
    this.code = code;
    this.status = status;
    this.fields = fields;
    Object.setPrototypeOf(this, ApplicationError.prototype);
  }

  public toJSON(requestId?: string): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields ? { fields: this.fields } : {}),
        ...(requestId ? { requestId } : {}),
      },
    };
  }
}
