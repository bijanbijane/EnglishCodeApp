export class AppError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) { super(message); this.name = "AppError"; }
}
export function errorResponse(code: string, message: string, requestId: string, status: number) {
  return { error: { code, message, requestId, status } } as const;
}