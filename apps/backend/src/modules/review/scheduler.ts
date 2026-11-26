export type ReviewRating = 0 | 1 | 2 | 3;

export interface ReviewState {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
}

export interface ReviewSchedule extends ReviewState {
  dueAt: string;
  schedulerVersion: 1;
  state: "learning" | "review" | "mastered";
}

/**
 * Deterministic SM-2-inspired scheduler v1.
 * Ratings: 0=again, 1=hard, 2=good, 3=easy.
 * This is a product heuristic, not a claim of scientifically optimal scheduling.
 */
export function scheduleNextReview(
  current: ReviewState,
  rating: ReviewRating,
  reviewedAt: Date
): ReviewSchedule {
  if (!Number.isFinite(reviewedAt.getTime())) throw new Error("reviewedAt must be a valid date");
  const ease = Math.min(3, Math.max(1.3, current.easeFactor));
  let intervalDays: number;
  let easeFactor = ease;
  let repetitions = current.repetitions;
  let lapses = current.lapses;
  let state: ReviewSchedule["state"];

  if (rating === 0) {
    intervalDays = 0;
    repetitions = 0;
    lapses += 1;
    easeFactor = Math.max(1.3, ease - 0.2);
    state = "learning";
  } else if (rating === 1) {
    intervalDays = Math.max(1, Math.round(Math.max(1, current.intervalDays) * 1.2));
    repetitions += 1;
    easeFactor = Math.max(1.3, ease - 0.15);
    state = "review";
  } else if (rating === 2) {
    intervalDays = repetitions === 0 ? 1 : repetitions === 1 ? 3 : Math.max(1, Math.round(Math.max(1, current.intervalDays) * ease));
    repetitions += 1;
    state = intervalDays >= 21 ? "mastered" : "review";
  } else {
    intervalDays = repetitions === 0 ? 2 : Math.max(2, Math.round(Math.max(1, current.intervalDays) * (ease + 0.3)));
    repetitions += 1;
    easeFactor = Math.min(3, ease + 0.1);
    state = intervalDays >= 21 ? "mastered" : "review";
  }

  const due = new Date(reviewedAt.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  return {
    intervalDays, easeFactor: Math.round(easeFactor * 100) / 100,
    repetitions, lapses, dueAt: due.toISOString(), schedulerVersion: 1, state
  };
}
