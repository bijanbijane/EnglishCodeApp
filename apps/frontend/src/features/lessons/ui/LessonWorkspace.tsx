import { useEffect, useRef, useState } from "react";
import { createSingleFlightGuard } from "../../../shared/async/single-flight";
import { getLessonQuestions } from "../api/questions.api";
import { startLessonAttempt, submitLessonAnswer, completeLessonAttempt } from "../api/attempts.api";
import type { Lesson } from "../model/lesson.types";
import type { LessonQuestion, LessonQuestionsState, LessonQuestionOption } from "../model/question.types";
import type { AnswerSubmissionResult, LessonCompletionResult } from "../api/attempts.api";

type LessonWorkspaceProps = { lesson: Lesson; onBack: () => void; canStartAttempt: boolean; sessionMessage?: string; onAttemptActiveChange: (active: boolean) => void };

function optionLabel(option: LessonQuestionOption): string {
  if (typeof option === "string") return option;
  return option.text ?? option.label ?? option.value ?? "گزینهٔ نامعتبر";
}

function optionId(option: LessonQuestionOption): string | null {
  if (typeof option === "string") return option;
  return option.id ?? option.value ?? null;
}

function QuestionCard({ question, index, attemptId, onSubmitted }: {
  question: LessonQuestion;
  index: number;
  attemptId: string | null;
  onSubmitted: (questionId: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerSubmissionResult | null>(null);
  const [previouslyRecorded, setPreviouslyRecorded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitGuard = useRef(createSingleFlightGuard());
  const options = Array.isArray(question.options) ? question.options : [];

  async function submit() {
    if (!attemptId || !selected || result) return;
    await submitGuard.current.run(async () => {
      setSubmitting(true);
      setError(null);
      try {
        const response = await submitLessonAnswer(attemptId, question.id, selected);
        const answerWasAlreadyRecorded = response.answerId !== selected;
        setPreviouslyRecorded(answerWasAlreadyRecorded);
        if (answerWasAlreadyRecorded) setSelected(response.answerId);
        setResult(response);
        onSubmitted(question.id);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "ثبت پاسخ انجام نشد.");
      } finally {
        setSubmitting(false);
      }
    });
  }

  return (
    <article className="question-card">
      <div className="question-card__meta"><span>تمرین {index + 1}</span><span>{options.length} گزینه</span></div>
      <h3>{question.prompt}</h3>
      {options.length > 0 ? (
        <div className="answer-options" role="group" aria-label={"گزینه‌های تمرین " + (index + 1)}>
          {options.map((option, optionIndex) => {
            const id = optionId(option);
            return (
              <button
                className={"answer-option" + (selected === id ? " answer-option--selected" : "")}
                key={id ?? question.id + "-" + optionIndex}
                type="button"
                aria-pressed={selected === id}
                disabled={!id || Boolean(result) || submitting}
                onClick={() => setSelected(id)}
              >
                <span className="answer-option__marker">{String.fromCharCode(65 + optionIndex)}</span>
                <span>{optionLabel(option)}</span>
              </button>
            );
          })}
        </div>
      ) : <p className="question-unavailable">گزینه‌های این تمرین در قالب قابل نمایش نیستند.</p>}
      {attemptId && !result && (
        <div className="question-actions">
          <button className="button button--secondary" type="button" disabled={!selected || submitting} onClick={() => void submit()}>
            {submitting ? "در حال ثبت پاسخ…" : "ثبت پاسخ"}
          </button>
        </div>
      )}
      {result && (
        <div className={result.isCorrect ? "answer-feedback answer-feedback--correct" : "answer-feedback answer-feedback--incorrect"} role="status">
          <strong>{result.isCorrect ? "پاسخ درست است." : "این پاسخ درست نیست."}</strong>
          {previouslyRecorded && <p>پاسخ قبلی این پرسش در سرور ثبت شده بود؛ همان پاسخ مبنای نتیجه است.</p>}
          <p>{result.explanation}</p>
        </div>
      )}
      {error && <p className="inline-error" role="alert">{error}</p>}
    </article>
  );
}

export function LessonWorkspace({ lesson, onBack, canStartAttempt, sessionMessage, onAttemptActiveChange }: LessonWorkspaceProps) {
  const [state, setState] = useState<LessonQuestionsState>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [answeredIds, setAnsweredIds] = useState<string[]>([]);
  const [completing, setCompleting] = useState(false);
  const [completion, setCompletion] = useState<LessonCompletionResult | null>(null);
  const startGuard = useRef(createSingleFlightGuard());
  const completionGuard = useRef(createSingleFlightGuard());

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    getLessonQuestions(lesson.id)
      .then((questions) => { if (active) setState({ status: "ready", questions }); })
      .catch((error: unknown) => {
        if (active) setState({ status: "error", message: error instanceof Error ? error.message : "دریافت تمرین‌ها ناموفق بود." });
      });
    return () => { active = false; };
  }, [lesson.id, reloadCount]);

  useEffect(() => {
    if (!attemptId || completion) return;
    const warnBeforeExit = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeExit);
    return () => window.removeEventListener("beforeunload", warnBeforeExit);
  }, [attemptId, completion]);

  async function beginAttempt() {
    if (attemptId) return;
    await startGuard.current.run(async () => {
      setStarting(true);
      setStartError(null);
      try {
        const attempt = await startLessonAttempt(lesson.id);
        setAttemptId(attempt.attemptId);
        onAttemptActiveChange(true);
      } catch (error) {
        setStartError(error instanceof Error ? error.message : "شروع تمرین انجام نشد.");
      } finally {
        setStarting(false);
      }
    });
  }

  async function finishAttempt() {
    if (!attemptId || completion || state.status !== "ready") return;
    await completionGuard.current.run(async () => {
      setCompleting(true);
      setStartError(null);
      try {
        const result = await completeLessonAttempt(attemptId);
        setCompletion(result);
        onAttemptActiveChange(false);
      } catch (error) {
        setStartError(error instanceof Error ? error.message : "تکمیل درس انجام نشد.");
      } finally {
        setCompleting(false);
      }
    });
  }

  const questions = state.status === "ready" ? state.questions : [];
  const allAnswered = questions.length > 0 && answeredIds.length === questions.length;
  const progressPercent = Math.round(completion ? 100 : questions.length ? answeredIds.length / questions.length * 100 : 0);

  return (
    <section className="workspace" aria-labelledby="workspace-title">
      <button className="back-link" type="button" onClick={onBack}>→ بازگشت به درس‌ها</button>
      <header className="workspace-header">
        <div>
          <span className="level-tag">{lesson.level}</span>
          <p className="eyebrow">LESSON PLAYER</p>
          <h1 id="workspace-title">{lesson.title}</h1>
          <p>پاسخ‌ها به سرور فرستاده می‌شوند و ارزیابی و امتیاز نهایی را سرور تعیین می‌کند.</p>
        </div>
        <div className="workspace-progress" aria-label="پیشرفت تمرین">
          <span>{completion ? "درس تکمیل شد" : attemptId ? "تمرین در حال انجام" : "آمادهٔ شروع"}</span>
          <strong>{completion ? completion.score + "%" : attemptId ? answeredIds.length + " از " + questions.length : "۰٪"}</strong>
          <div role="progressbar" aria-label="درصد پیشرفت درس" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}><i style={{ width: progressPercent + "%" }} /></div>
        </div>
      </header>

      {state.status === "loading" && <div className="state-panel" role="status" aria-live="polite"><span className="loader" aria-hidden="true" /> در حال دریافت تمرین‌ها…</div>}
      {state.status === "error" && <div className="state-panel state-panel--error" role="alert"><div><strong>تمرین‌ها بارگذاری نشدند.</strong><p>{state.message}</p></div><button className="button button--secondary" type="button" onClick={() => setReloadCount((count) => count + 1)}>تلاش دوباره</button></div>}
      {state.status === "ready" && state.questions.length === 0 && <div className="state-panel"><strong>برای این درس هنوز تمرینی ثبت نشده است.</strong><p>محتوای تمرین پس از انتشار در این بخش نمایش داده می‌شود.</p></div>}
      {state.status === "ready" && state.questions.length > 0 && (
        <>
          {!attemptId && (
            <div className="attempt-intro">
              <div><strong>آماده‌ای تمرین را شروع کنی؟</strong><p>{state.questions.length} پرسش در این درس وجود دارد. پاسخ‌ها در سرور ثبت می‌شوند. اگر پیش از تکمیل از صفحه خارج شوی، در نسخهٔ فعلی امکان ادامهٔ همین تلاش وجود ندارد.</p></div>
              {canStartAttempt ? <button className="button button--secondary" type="button" disabled={starting} onClick={() => void beginAttempt()}>{starting ? "در حال شروع…" : "شروع تمرین"}</button> : <span className="session-notice">{sessionMessage ?? "برای ثبت پاسخ باید از داخل تلگرام وارد حساب شوی."}</span>}
            </div>
          )}
          {startError && <p className="inline-error" role="alert">{startError}</p>}
          <div className="question-list">
            <div className="question-list__heading"><h2>تمرین‌های درس</h2><span>{state.questions.length} تمرین</span></div>
            {state.questions.map((question, index) => <QuestionCard key={question.id} question={question} index={index} attemptId={completion ? null : attemptId} onSubmitted={(questionId) => setAnsweredIds((current) => current.includes(questionId) ? current : [...current, questionId])} />)}
          </div>
          {attemptId && !completion && (
            <div className="attempt-footer">
              <span>{answeredIds.length} از {questions.length} پاسخ ثبت شده</span>
              <button className="button button--secondary" type="button" disabled={!allAnswered || completing} onClick={() => void finishAttempt()}>{completing ? "در حال محاسبهٔ نتیجه…" : "تکمیل درس و دریافت نتیجه"}</button>
            </div>
          )}
          {completion && <div className="completion-panel" role="status"><span className="completion-panel__label">نتیجهٔ ثبت‌شده در سرور</span><strong>{completion.score}٪</strong><p>این نتیجه از پاسخ‌های ثبت‌شده در همین تلاش محاسبه شده است.</p></div>}
        </>
      )}
    </section>
  );
}
