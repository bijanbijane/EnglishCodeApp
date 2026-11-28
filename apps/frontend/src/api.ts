export type ApiEnvelope<T> = { data: T; meta?: { requestId?: string; nextCursor?: string | null } };
export type Course = {
  id: string; slug: string; title: string; description: string | null;
  source_language: string; target_language: string;
};
export type Lesson = {
  id: string; course_id: string; slug: string; title: string;
  description: string | null; level: string | null; position: number; version: number;
};
export type Option = { id: string; text: string };
export type AttemptQuestion = {
  id: string; type: string; prompt: string; options: Option[];
  position: number; submittedAnswer: string | null; isCorrect: boolean | null;
};
export type Attempt = {
  id: string; lesson_id: string; status: "in_progress" | "completed";
  score: number | null; questions: AttemptQuestion[];
};
export type Profile = { id: string; display_name: string | null; created_at: string };
export type ProgressEntry = { lesson_id: string; course_id: string; best_score: number; completed_count: number; lesson_title: string; last_completed_at: string };
export type LearningHistoryEntry = {
  attemptId: string; lessonId: string; lessonVersion: number;
  lessonTitle: string; courseId: string; courseTitle: string;
  status: "completed"; score: number; startedAt: string; completedAt: string;
  questionCount: number; correctAnswerCount: number;
};

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
let accessToken: string | null = null;

export function setAccessToken(token: string | null) { accessToken = token; }

async function requestEnvelope<T>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init, headers, credentials: "omit",
  });
  const payload = await response.json().catch(() => null) as
    | { data?: T; meta?: ApiEnvelope<T>["meta"]; error?: { message?: string; code?: string; requestId?: string } }
    | null;
  if (!response.ok) {
    const message = payload?.error?.message ?? `Request failed (${response.status})`;
    throw new ApiError(
      payload?.error?.requestId ? `${message} [${payload.error.requestId}]` : message,
      response.status,
      payload?.error?.code,
    );
  }
  if (!payload || !("data" in payload)) throw new Error("The server returned an invalid response.");
  return { data: payload.data as T, meta: payload.meta };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  return (await requestEnvelope<T>(path, init)).data;
}

export const api = {
  courses: () => request<Course[]>("/courses"),
  lessons: (courseId: string) => request<Lesson[]>(`/courses/${encodeURIComponent(courseId)}/lessons`),
  profile: () => request<Profile>("/me"),
  login: (initData: string) => request<{ accessToken: string; expiresAt: string; user: { id: string; displayName: string | null } }>(
    "/auth/telegram", { method: "POST", body: JSON.stringify({ initData }) },
  ),
  startAttempt: (lessonId: string) => request<{ attemptId: string; status: string }>(
    `/lessons/${encodeURIComponent(lessonId)}/attempts`, { method: "POST", body: "{}" },
  ),
  attempt: (attemptId: string) => request<Attempt>(`/attempts/${encodeURIComponent(attemptId)}`),
  answer: (attemptId: string, questionId: string, answer: string) => request<{ accepted: boolean; isCorrect: boolean; duplicate: boolean }>(
    `/attempts/${encodeURIComponent(attemptId)}/answers`,
    { method: "POST", body: JSON.stringify({ questionId, answer }) },
  ),
  complete: (attemptId: string) => request<{ status: string; score: number; completedAt: string }>(
    `/attempts/${encodeURIComponent(attemptId)}/complete`, { method: "POST", body: "{}" },
  ),
  progress: () => request<ProgressEntry[]>("/me/progress"),
  history: (limit = 5, cursor?: string | null) => {
    const query = new URLSearchParams({ limit: String(limit) });
    if (cursor) query.set("cursor", cursor);
    return requestEnvelope<LearningHistoryEntry[]>(`/me/history?${query.toString()}`);
  },
  logout: () => request<{ loggedOut: boolean }>("/auth/logout", { method: "POST", body: "{}" }),
};

declare global {
  interface ImportMetaEnv { readonly VITE_API_BASE_URL?: string }
  interface ImportMeta { readonly env: ImportMetaEnv }
}
