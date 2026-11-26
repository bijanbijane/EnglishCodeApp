import type { Lesson } from "../model/lesson.types";

type LessonCatalogProps = {
  lessons: Lesson[];
  onRetry: () => void;
  state: "loading" | "ready" | "error";
  errorMessage?: string;
};

function LessonCard({ lesson }: { lesson: Lesson }) {
  return (
    <article className="lesson-card">
      <div className="lesson-card__index" aria-hidden="true">
        {String(lesson.position).padStart(2, "0")}
      </div>
      <div className="lesson-card__body">
        <div className="lesson-card__meta">
          <span className="level-tag">{lesson.level}</span>
          <span className="lesson-card__type">درس آموزشی</span>
        </div>
        <h3>{lesson.title}</h3>
        <p>{lesson.description || "یک گام کوتاه در مسیر یادگیری انگلیسی."}</p>
      </div>
      <span className="lesson-card__arrow" aria-hidden="true">←</span>
    </article>
  );
}

export function LessonCatalog({
  lessons,
  onRetry,
  state,
  errorMessage,
}: LessonCatalogProps) {
  if (state === "loading") {
    return (
      <div className="state-panel" role="status" aria-live="polite">
        <span className="loader" aria-hidden="true" />
        <span>در حال دریافت مسیرهای آموزشی…</span>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <div>
          <strong>بارگذاری درس‌ها انجام نشد.</strong>
          <p>{errorMessage || "اتصال را بررسی و دوباره تلاش کنید."}</p>
        </div>
        <button className="button button--secondary" onClick={onRetry}>
          تلاش دوباره
        </button>
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <div className="state-panel">
        <strong>هنوز درسی منتشر نشده است.</strong>
        <p>با انتشار محتوای آموزشی، درس‌ها در این بخش نمایش داده می‌شوند.</p>
      </div>
    );
  }

  return (
    <div className="lesson-grid">
      {lessons.map((lesson) => (
        <LessonCard key={lesson.id} lesson={lesson} />
      ))}
    </div>
  );
}
