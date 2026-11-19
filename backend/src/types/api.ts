// backend/src/types/api.ts

export interface ApiErrorBody {
  code: string;
  message: string;
  fields?: Record<string, string>;
  requestId?: string;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}

export interface ApiPaginationMeta {
  limit: number;
  nextCursor: string | null;
}

export interface ApiSuccessResponse<T> {
  data: T;
  page?: ApiPaginationMeta;
  message?: string;
}
