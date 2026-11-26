import { useCallback, useEffect, useState } from "react";
import { getLessons } from "../features/lessons/api/lessons.api";
import { LessonCatalog } from "../features/lessons/ui/LessonCatalog";
import type { Lesson, LessonListState } from "../features/lessons/model/lesson.types";

export default function App() {
  const [lessonState, setLessonState] = useState<LessonListState>({
    status: "loading",
  });

  const loadLessons = useCallback(async () => {
    setLessonState({ status: "loading" });
    try {
      const lessons = await getLessons();
      setLessonState({ status: "ready", lessons });
    } catch (error) {
      setLessonState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "خطای پیش‌بینی‌نشده‌ای رخ داد.",
      });
    }
  }, []);

  useEffect(() => {
    void loadLessons();
  }, [loadLessons]);

  const lessons: Lesson[] =
    lessonState.status === "ready" ? lessonState.lessons : [];

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="صفحهٔ اصلی انگلیش‌کد">
          <span className="brand-mark">E</span>
          <span className="brand-name">English<span>Code</span></span>
        </a>
        <div className="topbar__actions">
          <span className="environment-pill">
            <span className="environment-pill__dot" />
            نسخهٔ آزمایشی
          </span>
          <div className="avatar" aria-label="پروفایل زبان‌آموز">E</div>
        </div>
      </header>

      <section className="welcome-panel">
        <div className="welcome-panel__content">
          <p className="eyebrow">YOUR ENGLISH LEARNING SPACE</p>
          <h1>یادگیری انگلیسی،<br /><span>قدم‌به‌قدم و هدفمند.</span></h1>
          <p className="welcome-panel__description">
            مسیرت را دنبال کن، تمرین کن و پیشرفت واقعی خودت را ببین.
          </p>
          <div className="welcome-panel__foot">
            <span className="welcome-panel__signal" />
            مسیر یادگیری از یک درس شروع می‌شود
          </div>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="welcome-art__orbit welcome-art__orbit--outer" />
          <div className="welcome-art__orbit welcome-art__orbit--inner" />
          <div className="welcome-art__letter">A<span>.</span></div>
          <span className="floating-word floating-word--one">learn</span>
          <span className="floating-word floating-word--two">practice</span>
          <span className="floating-word floating-word--three">grow</span>
        </div>
      </section>

      <section className="learning-overview" aria-label="نمای کلی یادگیری">
        <div className="section-heading">
          <div>
            <p className="eyebrow">LEARNING OVERVIEW</p>
            <h2>فضای یادگیری تو</h2>
          </div>
          <span className="section-caption">نسخهٔ اولیه</span>
        </div>
        <div className="overview-grid">
          <article className="overview-card overview-card--primary">
            <span className="overview-card__icon" aria-hidden="true">↗</span>
            <div>
              <strong>مسیر یادگیری</strong>
              <p>درس‌ها را به‌ترتیب دنبال کن.</p>
            </div>
          </article>
          <article className="overview-card">
            <span className="overview-card__icon overview-card__icon--mint" aria-hidden="true">✓</span>
            <div>
              <strong>پیشرفت قابل سنجش</strong>
              <p>نتیجهٔ تمرین‌ها در حساب تو ثبت می‌شود.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="lessons-section" aria-labelledby="lessons-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">START LEARNING</p>
            <h2 id="lessons-title">درس‌های در دسترس</h2>
          </div>
          {lessonState.status === "ready" && (
            <span className="lesson-count">{lessons.length} درس</span>
          )}
        </div>
        <LessonCatalog
          lessons={lessons}
          state={lessonState.status}
          errorMessage={lessonState.status === "error" ? lessonState.message : undefined}
          onRetry={() => void loadLessons()}
        />
      </section>

      <footer className="footer">
        <span>یادگیری با استمرار ساخته می‌شود.</span>
        <span className="footer__brand">EnglishCode · MVP</span>
      </footer>

      <nav className="mobile-nav" aria-label="ناوبری اصلی">
        <a className="mobile-nav__item mobile-nav__item--active" href="/" aria-current="page">
          <span aria-hidden="true">⌂</span><small>خانه</small>
        </a>
        <a className="mobile-nav__item" href="#lessons-title">
          <span aria-hidden="true">▤</span><small>درس‌ها</small>
        </a>
        <span className="mobile-nav__item mobile-nav__item--disabled" aria-disabled="true">
          <span aria-hidden="true">◷</span><small>پیشرفت</small>
        </span>
        <span className="mobile-nav__item mobile-nav__item--disabled" aria-disabled="true">
          <span aria-hidden="true">○</span><small>پروفایل</small>
        </span>
      </nav>
    </main>
  );
}
