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
  const [selectedLevel, setSelectedLevel] = useState("");
  const lessons = state.status === "ready" ? state.lessons : [];
  const levels = useMemo(() => {
    const order = ["A1", "A2", "B1", "B2", "C1", "C2"];
    return [...new Set(lessons.map((lesson) => lesson.level.trim()).filter(Boolean))]
      .sort((left, right) => {
        const leftIndex = order.indexOf(left.toUpperCase());
        const rightIndex = order.indexOf(right.toUpperCase());
        if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
        if (leftIndex >= 0) return -1;
        if (rightIndex >= 0) return 1;
        return left.localeCompare(right);
      });
  }, [lessons]);
  const visibleLessons = useMemo(
    () => filterLessons(lessons, search, selectedLevel),
    [lessons, search, selectedLevel],
  );

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
        <div className="learning-library__filters">
          <label className="learning-library__level-control">
            <span>سطح</span>
            <select
              className="learning-library__level-filter"
              value={selectedLevel}
              onChange={(event) => setSelectedLevel(event.target.value)}
              aria-label="فیلتر سطح زبان"
            >
              <option value="">همهٔ سطح‌ها</option>
              {levels.map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
          </label>
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
        </div>
        {state.status === "ready" && (
          <span className="lesson-count" aria-live="polite">
            {visibleLessons.length === lessons.length
              ? `${lessons.length} درس`
              : `${visibleLessons.length} از ${lessons.length} درس`}
          </span>
        )}
      </div>

      {state.status === "ready" && (search.trim() || selectedLevel) && visibleLessons.length === 0 ? (
        <div className="state-panel" role="status">
          <div><strong>درسی با این مشخصات پیدا نشد.</strong><p>عبارت جست‌وجو یا سطح انتخاب‌شده را تغییر بده.</p></div>
          <button className="button button--secondary" type="button" onClick={() => { setSearch(""); setSelectedLevel(""); }}>پاک‌کردن فیلترها</button>
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
