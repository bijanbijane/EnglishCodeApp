import { apiGet } from "../../../shared/api/client";

export type LessonProgress = {
  lesson_id: string;
  best_score: number;
  completed_count: number;
  last_completed_at: string | null;
};

export type LearnerProfile = { id: string; displayName: string | null };

export function getMyProgress(): Promise<LessonProgress[]> {
  return apiGet<LessonProgress[]>("/api/v1/me/progress");
}

export function getMyProfile(): Promise<LearnerProfile> {
  return apiGet<LearnerProfile>("/api/v1/me");
}
