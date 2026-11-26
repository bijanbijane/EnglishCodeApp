import { describe, expect, it } from "vitest";
import { calculateLessonScore, gradeAnswer } from "../src/modules/learning/domain";

describe("learning domain rules", () => {
  it("grades answers using the server-side answer key", () => {
    expect(gradeAnswer("option-a", "option-a")).toBe(true);
    expect(gradeAnswer("option-b", "option-a")).toBe(false);
  });
  it("calculates a rounded percentage score", () => {
    expect(calculateLessonScore(2, 3)).toBe(67);
    expect(calculateLessonScore(0, 4)).toBe(0);
    expect(calculateLessonScore(4, 4)).toBe(100);
  });
  it("rejects invalid assessment counts", () => {
    expect(() => calculateLessonScore(1, 0)).toThrow();
    expect(() => calculateLessonScore(3, 2)).toThrow();
  });
});
