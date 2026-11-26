import type { Lesson } from "../model/lesson.types";

type LessonCatalogProps = {
  lessons: Lesson[];
  onRetry: () => void;
  onSelect: (lesson: Lesson) => void;
  state: "loading" | "ready" | "error";
  errorMessage?: string;
};

function LessonCard({ lesson, onSelect }: { lesson: Lesson; onSelect: () => void }) {
  return (
    <button className="lesson-card lesson-card--interactive" type="button" onClick={onSelect} aria-label={"مشاهدهٔ درس " + lesson.title}>
      <span className="lesson-card__index" aria-hidden="true">{String(lesson.position).padStart(2, "0")}</span>
      <span className="lesson-card__body"><span className="lesson-card__meta"><span className="level-tag">{lesson.level}</span><span className="lesson-card__type">درس آموزشی</span></span><strong className="lesson-card__title">{lesson.title}</strong><span className="lesson-card__description">{lesson.description || "یک گام کوتاه در مسیر یادگیری انگلیسی."}</span></span>
      <span className="lesson-card__arrow" aria-hidden="true">←</span>
    </button>
  );
}

export function LessonCatalog({ lessons, onRetry, onSelect, state, errorMessage }: LessonCatalogProps) {
  if (state === "loading") return <div className="state-panel" role="status" aria-live="polite"><span className="loader" aria-hidden="true" /><span>در حال دریافت مسیرهای آموزشی…</span></div>;
  if (state === "error") return <div className="state-panel state-panel--error" role="alert"><div><strong>بارگذاری درس‌ها انجام نشد.</strong><p>{errorMessage || "اتصال را بررسی و دوباره تلاش کنید."}</p></div><button className="button button--secondary" onClick={onRetry}>تلاش دوباره</button></div>;
  if (lessons.length === 0) return <div className="state-panel"><strong>درسی با این مشخصات پیدا نشد.</strong><p>عبارت جست‌وجو را تغییر بده یا بعداً دوباره بررسی کن.</p></div>;
  return <div className="lesson-grid">{lessons.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} onSelect={() => onSelect(lesson)} />)}</div>;
}
