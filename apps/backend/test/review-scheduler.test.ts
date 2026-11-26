import { describe, expect, it } from "vitest";
import { scheduleNextReview } from "../src/modules/review/scheduler";

describe("spaced repetition scheduler v1", () => {
  const at = new Date("2026-11-26T12:00:00.000Z");
  const initial = { intervalDays: 0, easeFactor: 2.5, repetitions: 0, lapses: 0 };

  it("schedules an initial good response for one day", () => {
    const result = scheduleNextReview(initial, 2, at);
    expect(result.intervalDays).toBe(1);
    expect(result.dueAt).toBe("2026-11-27T12:00:00.000Z");
    expect(result.repetitions).toBe(1);
  });

  it("resets learning after again and lowers ease without going below floor", () => {
    const result = scheduleNextReview({ intervalDays: 30, easeFactor: 1.3, repetitions: 5, lapses: 1 }, 0, at);
    expect(result.intervalDays).toBe(0);
    expect(result.repetitions).toBe(0);
    expect(result.lapses).toBe(2);
    expect(result.easeFactor).toBe(1.3);
    expect(result.state).toBe("learning");
  });

  it("caps ease and marks long intervals mastered", () => {
    const result = scheduleNextReview({ intervalDays: 30, easeFactor: 3, repetitions: 4, lapses: 0 }, 3, at);
    expect(result.easeFactor).toBe(3);
    expect(result.state).toBe("mastered");
  });

  it("rejects invalid dates", () => {
    expect(() => scheduleNextReview(initial, 2, new Date("invalid"))).toThrow("valid date");
  });
});
