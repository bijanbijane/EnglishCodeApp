import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Attempt, type AttemptQuestion, type Lesson, type Profile } from "../api";

type Options = {
  profile: Profile | null;
  refreshProgress: () => Promise<unknown>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onCompleted: (score: number) => void;
};

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export function useAttemptLifecycle({
  profile, refreshProgress, onError, onNotice, onCompleted,
}: Options) {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    setAttempt(null);
    setBusy(false);
    return () => { generation.current += 1; };
  }, [profile?.id]);

  const startAttempt = useCallback(async (lesson: Lesson) => {
    if (!profile || busy) return false;
    const requestGeneration = generation.current;
    setBusy(true);
    try {
      const created = await api.startAttempt(lesson.id);
      const loaded = await api.attempt(created.attemptId);
      if (generation.current !== requestGeneration) return false;
      setAttempt(loaded);
      return true;
    } catch (error) {
      if (generation.current === requestGeneration) onError(messageOf(error, "Could not start this lesson."));
      return false;
    } finally {
      if (generation.current === requestGeneration) setBusy(false);
    }
  }, [profile, busy, onError]);

  const submitAnswer = useCallback(async (question: AttemptQuestion, answer: string | null) => {
    const currentAttempt = attempt;
    if (!currentAttempt || !answer || question.submittedAnswer !== null || busy) return false;
    const requestGeneration = generation.current;
    setBusy(true);
    onError("");
    try {
      const result = await api.answer(currentAttempt.id, question.id, answer);
      if (generation.current !== requestGeneration) return false;
      if (!result.accepted) throw new Error("The server did not accept this answer.");

      // The accepted POST is authoritative; a subsequent read is only a refresh.
      setAttempt((current) => current?.id === currentAttempt.id ? {
        ...current,
        questions: current.questions.map((item) => item.id === question.id
          ? { ...item, submittedAnswer: answer, isCorrect: result.isCorrect }
          : item),
      } : current);
      onNotice(result.isCorrect ? "Correct answer." : "Not quite. Keep going.");

      try {
        const refreshed = await api.attempt(currentAttempt.id);
        if (generation.current === requestGeneration) {
          setAttempt((current) => current?.id === currentAttempt.id ? refreshed : current);
        }
      } catch {
        if (generation.current === requestGeneration) onNotice(result.isCorrect
          ? "Correct answer. Your answer was saved, but the lesson could not refresh. You can continue."
          : "Answer saved. The lesson could not refresh. You can continue.");
      }
      return generation.current === requestGeneration;
    } catch (error) {
      if (generation.current === requestGeneration) onError(messageOf(error, "Could not submit the answer."));
      return false;
    } finally {
      if (generation.current === requestGeneration) setBusy(false);
    }
  }, [attempt, busy, onError, onNotice]);

  const completeAttempt = useCallback(async () => {
    const currentAttempt = attempt;
    if (!currentAttempt || busy) return;
    const requestGeneration = generation.current;
    setBusy(true);
    onError("");
    try {
      const result = await api.complete(currentAttempt.id);
      if (generation.current !== requestGeneration) return;
      onCompleted(result.score);
      try {
        await refreshProgress();
      } catch {
        if (generation.current === requestGeneration) onNotice("Lesson completed. Progress details will refresh when you return.");
      }
    } catch (error) {
      if (generation.current === requestGeneration) onError(messageOf(error, "Could not complete the lesson."));
    } finally {
      if (generation.current === requestGeneration) setBusy(false);
    }
  }, [attempt, busy, onCompleted, onError, onNotice, refreshProgress]);

  const clearAttempt = useCallback(() => setAttempt(null), []);

  return { attempt, busy, startAttempt, submitAnswer, completeAttempt, clearAttempt };
}
