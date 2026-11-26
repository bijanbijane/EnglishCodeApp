export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiEnvelope<T> = { data: T };
export type ApiRequestOptions = { accessToken?: string };

export class ApiContractError extends Error {
  readonly code = "INVALID_RESPONSE_ENVELOPE";
  constructor() {
    super("ساختار پاسخ دریافتی از سرویس معتبر نیست.");
    this.name = "ApiContractError";
  }
}

export function unwrapApiEnvelope<T>(payload: unknown): T {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload) || !Object.prototype.hasOwnProperty.call(payload, "data")) {
    throw new ApiContractError();
  }
  return (payload as ApiEnvelope<T>).data;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, options: ApiRequestOptions = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (options.accessToken) headers.set("Authorization", "Bearer " + options.accessToken);

  const response = await fetch(path, { ...init, headers, credentials: "same-origin" });
  if (!response.ok) {
    let message = "ارتباط با سرویس برقرار نشد.";
    let code: string | undefined;
    try {
      const payload = (await response.json()) as { error?: { message?: string; code?: string }; message?: string };
      message = payload.error?.message ?? payload.message ?? message;
      code = payload.error?.code;
    } catch {
      // Keep the safe fallback when the response is not JSON.
    }
    throw new ApiError(message, response.status, code);
  }
  return (await response.json()) as T;
}

export async function apiGet<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return unwrapApiEnvelope<T>(await apiRequest<unknown>(path, {}, options));
}

export async function apiPost<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Promise<T> {
  return unwrapApiEnvelope<T>(await apiRequest<unknown>(path, { method: "POST", body: JSON.stringify(body) }, options));
}
