export class AppError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
    this.name = "AppError";
  }
}
export function errorBody(code: string, message: string, requestId?: string) {
  return { error: { code, message, ...(requestId ? { requestId } : {}) } };
}
