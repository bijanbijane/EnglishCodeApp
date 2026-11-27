export type ErrorCode =
  | "INTERNAL_ERROR"
  | "NOT_FOUND"
  | "SERVICE_UNAVAILABLE"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 | 502 | 503 = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorBody(code: string, message: string, requestId: string) {
  return {
    error: { code, message, requestId },
  };
}
