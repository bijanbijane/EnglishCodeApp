import { useEffect, useState } from "react";
import { getLessonQuestions } from "../api/questions.api";
import type { Lesson } from "../model/lesson.types";
import type { LessonQuestion, LessonQuestionsState } from "../model/question.types";

type LessonWorkspaceProps = { lesson: Lesson; onBack: () => void };

function optionLabel(option: unknown): string {
  if (typeof option === "string") return option;
  if (option && typeof option === "object") {
    const candidate = option as Record<string, unknown>;
    for (const key of ["label", "text", "value"]) {
      if (typeof candidate[key] === "string") return candidate[key];
    }
  }
  return "گزینهٔ نامعتبر";
}

function QuestionCard({ question, index }: { question: LessonQuestion; index: number }) {
  const [selected, setSelected] = useState<number | null>(null);
  const options = Array.isArray(question.options) ? question.options : [];

  return (
    <article className="question-card">
      <div className="question-card__meta">
        <span>تمرین {index + 1}</span>
        <span>{options.length} گزینه</span>
      </div>
      <h3>{question.prompt}</h3>
      {options.length > 0 ? (
        <div className="answer-options" role="group" aria-label={`گزینه‌های تمرین ${index + 1}`}>
          {options.map((option, optionIndex) => (
            <button
              className={`answer-option${selected === optionIndex ? " answer-option--selected" : ""}`}
              key={typeof option === "object" && option !== null && "id" in option && typeof option.id === "string" ? option.id : `${question.id}-${optionIndex}`}
              type="button"
              aria-pressed={selected === optionIndex}
              onClick={() => setSelected(optionIndex)}
            >
              <span className="answer-option__marker">{String.fromCharCode(65 + optionIndex)}</span>
              <span>{optionLabel(option)}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="question-unavailable">گزینه‌های این تمرین در قالب قابل نمایش نیستند.</p>
      )}
      <p className="preview-note">این بخش فعلاً پیش‌نمایش رابط تمرین است؛ ثبت پاسخ و ارزیابی به اتصال نشست امن نیاز دارد.</p>
    </article>
  );
}

export function LessonWorkspace({ lesson, onBack }: LessonWorkspaceProps) {
  const [state, setState] = useState<LessonQuestionsState>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);

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

  return (
    <section className="workspace" aria-labelledby="workspace-title">
      <button className="back-link" type="button" onClick={onBack}>→ بازگشت به درس‌ها</button>
      <header className="workspace-header">
        <div>
          <span className="level-tag">{lesson.level}</span>
          <p className="eyebrow">LESSON PREVIEW</p>
          <h1 id="workspace-title">{lesson.title}</h1>
          <p>ابتدا محتوای تمرین را مرور کن. ثبت و ارزیابی پاسخ‌ها پس از تکمیل اتصال امن فعال می‌شود.</p>
        </div>
        <div className="workspace-progress" aria-label="پیشرفت این پیش‌نمایش">
          <span>پیش‌نمایش درس</span><strong>۰٪</strong><div><i /></div>
        </div>
      </header>

      {state.status === "loading" && <div className="state-panel" role="status"><span className="loader" /> در حال دریافت تمرین‌ها…</div>}
      {state.status === "error" && <div className="state-panel state-panel--error" role="alert"><div><strong>تمرین‌ها بارگذاری نشدند.</strong><p>{state.message}</p></div><button className="button button--secondary" type="button" onClick={() => setReloadCount((count) => count + 1)}>تلاش دوباره</button></div>}
      {state.status === "ready" && state.questions.length === 0 && <div className="state-panel"><strong>برای این درس هنوز تمرینی ثبت نشده است.</strong><p>محتوای تمرین پس از انتشار در این بخش نمایش داده می‌شود.</p></div>}
      {state.status === "ready" && state.questions.length > 0 && (
        <div className="question-list">
          <div className="question-list__heading"><h2>تمرین‌های درس</h2><span>{state.questions.length} تمرین</span></div>
          {state.questions.map((question, index) => <QuestionCard key={question.id} question={question} index={index} />)}
        </div>
      )}
    </section>
  );
}
