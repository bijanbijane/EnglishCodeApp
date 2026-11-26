import { useEffect, useState } from "react";
import { getLessonQuestions } from "../api/questions.api";
import { startLessonAttempt, submitLessonAnswer, completeLessonAttempt } from "../api/attempts.api";
import type { Lesson } from "../model/lesson.types";
import type { LessonQuestion, LessonQuestionsState, LessonQuestionOption } from "../model/question.types";
import type { AnswerSubmissionResult, LessonCompletionResult } from "../api/attempts.api";

type LessonWorkspaceProps = { lesson: Lesson; onBack: () => void; canStartAttempt: boolean; sessionMessage?: string };

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = Array.isArray(question.options) ? question.options : [];

  async function submit() {
    if (!attemptId || !selected || submitting || result) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await submitLessonAnswer(attemptId, question.id, selected);
      setResult(response);
      onSubmitted(question.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "ثبت پاسخ انجام نشد.");
    } finally {
      setSubmitting(false);
    }
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
                disabled={!id || Boolean(result)}
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
          <p>{result.explanation}</p>
        </div>
      )}
      {error && <p className="inline-error" role="alert">{error}</p>}
    </article>
  );
}

export function LessonWorkspace({ lesson, onBack, canStartAttempt, sessionMessage }: LessonWorkspaceProps) {
  const [state, setState] = useState<LessonQuestionsState>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [answeredIds, setAnsweredIds] = useState<string[]>([]);
  const [completing, setCompleting] = useState(false);
  const [completion, setCompletion] = useState<LessonCompletionResult | null>(null);

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

  async function beginAttempt() {
    if (starting || attemptId) return;
    setStarting(true);
    setStartError(null);
    try {
      const attempt = await startLessonAttempt(lesson.id);
      setAttemptId(attempt.attemptId);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "شروع تمرین انجام نشد.");
    } finally {
      setStarting(false);
    }
  }

  async function finishAttempt() {
    if (!attemptId || completing || completion || state.status !== "ready") return;
    setCompleting(true);
    setStartError(null);
    try {
      const result = await completeLessonAttempt(attemptId);
      setCompletion(result);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "تکمیل درس انجام نشد.");
    } finally {
      setCompleting(false);
    }
  }

  const questions = state.status === "ready" ? state.questions : [];
  const allAnswered = questions.length > 0 && answeredIds.length === questions.length;

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
          <div><i style={{ width: completion ? "100%" : questions.length ? (answeredIds.length / questions.length * 100) + "%" : "0%" }} /></div>
        </div>
      </header>

      {state.status === "loading" && <div className="state-panel" role="status"><span className="loader" /> در حال دریافت تمرین‌ها…</div>}
      {state.status === "error" && <div className="state-panel state-panel--error" role="alert"><div><strong>تمرین‌ها بارگذاری نشدند.</strong><p>{state.message}</p></div><button className="button button--secondary" type="button" onClick={() => setReloadCount((count) => count + 1)}>تلاش دوباره</button></div>}
      {state.status === "ready" && state.questions.length === 0 && <div className="state-panel"><strong>برای این درس هنوز تمرینی ثبت نشده است.</strong><p>محتوای تمرین پس از انتشار در این بخش نمایش داده می‌شود.</p></div>}
      {state.status === "ready" && state.questions.length > 0 && (
        <>
          {!attemptId && (
            <div className="attempt-intro">
              <div><strong>آماده‌ای تمرین را شروع کنی؟</strong><p>{state.questions.length} پرسش در این درس وجود دارد. نتیجه فقط پس از ثبت پاسخ‌ها در سرور محاسبه می‌شود.</p></div>
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
