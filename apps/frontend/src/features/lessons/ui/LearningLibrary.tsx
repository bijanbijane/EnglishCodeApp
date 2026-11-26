import { useMemo, useState } from "react";
import { LessonCatalog } from "./LessonCatalog";
import type { Lesson, LessonListState } from "../model/lesson.types";
import { filterLessons } from "../model/lesson-search";

type LearningLibraryProps = {
  state: LessonListState;
  onBack: () => void;
  onRetry: () => void;
  onSelect: (lesson: Lesson) => void;
};

export function LearningLibrary({ state, onBack, onRetry, onSelect }: LearningLibraryProps) {
  const [search, setSearch] = useState("");
  const lessons = state.status === "ready" ? state.lessons : [];
  const visibleLessons = useMemo(() => filterLessons(lessons, search), [lessons, search]);

  return (
    <section className="learning-library" aria-labelledby="learning-library-title">
      <button className="back-link" type="button" onClick={onBack}>
        ← بازگشت به خانه
      </button>
      <header className="learning-library__header">
        <p className="eyebrow">YOUR LEARNING PATH</p>
        <h1 id="learning-library-title">مسیر یادگیری انگلیسی</h1>
        <p>از درس‌های منتشرشده شروع کن. هر درس، تمرین و نتیجهٔ ثبت‌شدهٔ خودش را دارد.</p>
      </header>

      <div className="learning-library__toolbar">
        <label className="catalog-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جست‌وجوی عنوان، سطح یا توضیح درس"
            aria-label="جست‌وجوی درس‌ها"
          />
        </label>
        {state.status === "ready" && (
          <span className="lesson-count" aria-live="polite">
            {visibleLessons.length === lessons.length
              ? `${lessons.length} درس`
              : `${visibleLessons.length} از ${lessons.length} درس`}
          </span>
        )}
      </div>

      {state.status === "ready" && search.trim() && visibleLessons.length === 0 ? (
        <div className="state-panel" role="status">
          <div><strong>درسی با این عبارت پیدا نشد.</strong><p>عبارت جست‌وجو را کوتاه‌تر کن یا سطح دیگری را امتحان کن.</p></div>
          <button className="button button--secondary" type="button" onClick={() => setSearch("")}>پاک‌کردن جست‌وجو</button>
        </div>
      ) : (
        <LessonCatalog
          lessons={visibleLessons}
          state={state.status}
          errorMessage={state.status === "error" ? state.message : undefined}
          onRetry={onRetry}
          onSelect={onSelect}
        />
      )}
    </section>
  );
}
