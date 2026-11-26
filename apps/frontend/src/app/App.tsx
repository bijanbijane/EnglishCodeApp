import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLessons } from "../features/lessons/api/lessons.api";
import { LessonCatalog } from "../features/lessons/ui/LessonCatalog";
import { LessonWorkspace } from "../features/lessons/ui/LessonWorkspace";
import { ProfilePanel } from "../features/identity/ui/ProfilePanel";
import { ProgressPanel } from "../features/progress/ui/ProgressPanel";
import type { Lesson, LessonListState } from "../features/lessons/model/lesson.types";
import { bindTelegramLayoutMetrics, getPlatformContext, initializeTelegramHost, setTelegramBackAction } from "../services/platform/telegram";
import { bootstrapTelegramSession, signOut, type SessionBootstrapResult } from "../features/identity/api/auth.api";
import { subscribeToSessionInvalidation } from "../services/auth/session";
import { hashFromRoute, routeFromHash, type AppRoute } from "./navigation/routes";

export default function App() {
  const [lessonState, setLessonState] = useState<LessonListState>({ status: "loading" });
  const [route, setRoute] = useState<AppRoute>(() => typeof window === "undefined" ? { name: "home" } : routeFromHash(window.location.hash));
  const [signingOut, setSigningOut] = useState(false);
  const [activeAttempt, setActiveAttempt] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sessionState, setSessionState] = useState<SessionBootstrapResult | { status: "checking" }>({ status: "checking" });
  const hostInitialized = useRef(false);

  const navigateTo = useCallback((next: AppRoute) => {
    const leavingActiveLesson = route.name === "lesson" && (next.name !== "lesson" || next.lessonId !== route.lessonId);
    if (activeAttempt && leavingActiveLesson && typeof window !== "undefined" && !window.confirm("این تلاش هنوز کامل نشده و در نسخهٔ فعلی قابل ادامه نیست. از صفحه خارج می‌شوی؟")) return;
    if (activeAttempt && leavingActiveLesson) setActiveAttempt(false);
    setRoute(next);
    if (typeof window !== "undefined") {
      const nextHash = hashFromRoute(next);
      if (window.location.hash !== nextHash) window.location.hash = nextHash;
    }
  }, [activeAttempt, route]);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
      setSessionState({ status: "missing-init-data" });
      navigateTo({ name: "home" });
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "خروج از حساب انجام نشد.");
    } finally {
      setSigningOut(false);
    }
  }, [navigateTo]);

  const loadLessons = useCallback(async () => {
    setLessonState({ status: "loading" });
    try {
      const lessons = await getLessons();
      setLessonState({ status: "ready", lessons });
    } catch (error) {
      setLessonState({ status: "error", message: error instanceof Error ? error.message : "خطای پیش‌بینی‌نشده‌ای رخ داد." });
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const next = routeFromHash(window.location.hash);
      const leavingActiveLesson = route.name === "lesson" && (next.name !== "lesson" || next.lessonId !== route.lessonId);
      if (activeAttempt && leavingActiveLesson && !window.confirm("این تلاش هنوز کامل نشده و در نسخهٔ فعلی قابل ادامه نیست. از صفحه خارج می‌شوی؟")) {
        window.location.hash = hashFromRoute(route);
        return;
      }
      if (activeAttempt && leavingActiveLesson) setActiveAttempt(false);
      setRoute(next);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [activeAttempt, route]);

  useEffect(() => {
    if (hostInitialized.current || lessonState.status === "loading" || sessionState.status === "checking") return;
    hostInitialized.current = true;
    initializeTelegramHost();
    const cleanup = bindTelegramLayoutMetrics();
    return () => { cleanup(); hostInitialized.current = false; };
  }, [lessonState.status, sessionState.status]);

  useEffect(() => {
    let active = true;
    void bootstrapTelegramSession().then((result) => { if (active) setSessionState(result); });
    return () => { active = false; };
  }, []);

  useEffect(() => { void loadLessons(); }, [loadLessons]);
  useEffect(() => subscribeToSessionInvalidation(() => setSessionState({ status: "missing-init-data" })), []);

  useEffect(() => {
    if (route.name === "home") return;
    return setTelegramBackAction(() => navigateTo({ name: "home" }));
  }, [route, navigateTo]);

  const lessons = lessonState.status === "ready" ? lessonState.lessons : [];
  const selectedLesson: Lesson | null = route.name === "lesson" && lessonState.status === "ready"
    ? lessonState.lessons.find((lesson) => lesson.id === route.lessonId) ?? null
    : null;
  const canStartAttempt = sessionState.status === "authenticated";
  const sessionMessage = sessionState.status === "checking"
    ? "در حال بررسی نشست امن…"
    : sessionState.status === "browser-preview"
      ? "در مرورگر مستقل فعلاً فقط پیش‌نمایش عمومی فعال است؛ برای ثبت تمرین از Mini App تلگرام استفاده کن."
      : sessionState.status === "missing-init-data"
        ? "برای ورود معتبر، Mini App را از دکمهٔ منو یا صفحهٔ اصلی ربات باز کن."
        : sessionState.status === "secure-storage-unavailable"
          ? sessionState.message
          : sessionState.status === "error" ? sessionState.message : undefined;

  const visibleLessons = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return lessons;
    return lessons.filter((lesson) => (lesson.title + " " + lesson.level).toLocaleLowerCase().includes(term));
  }, [lessons, search]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#/" onClick={() => navigateTo({ name: "home" })} aria-label="صفحهٔ اصلی انگلیش‌کد">
          <span className="brand-mark">E</span>
          <span className="brand-name">English<span>Code</span></span>
        </a>
        <div className="topbar__actions">
          <span className="environment-pill"><span className="environment-pill__dot" /> نسخهٔ آزمایشی</span>
          <button className="avatar avatar--button" type="button" aria-label="باز کردن پروفایل" onClick={() => navigateTo({ name: "profile" })}>E</button>
        </div>
      </header>

      {route.name === "lesson" ? (
        lessonState.status === "loading" ? <div className="state-panel" role="status"><span className="loader" /> در حال بارگذاری درس…</div>
          : lessonState.status === "error" ? <div className="state-panel state-panel--error" role="alert"><div><strong>اطلاعات درس دریافت نشد.</strong><p>{lessonState.message}</p></div><button className="button button--secondary" type="button" onClick={() => void loadLessons()}>تلاش دوباره</button></div>
            : selectedLesson ? <LessonWorkspace key={selectedLesson.id} lesson={selectedLesson} onBack={() => navigateTo({ name: "home" })} canStartAttempt={canStartAttempt} sessionMessage={sessionMessage} onAttemptActiveChange={setActiveAttempt} />
              : <div className="state-panel"><strong>این درس در فهرست فعلی وجود ندارد.</strong><button className="button button--secondary" type="button" onClick={() => navigateTo({ name: "home" })}>بازگشت به درس‌ها</button></div>
      ) : route.name === "profile" ? (
        <ProfilePanel isAuthenticated={canStartAttempt} isTelegramHost={getPlatformContext().host === "telegram"} signingOut={signingOut} error={signOutError ?? undefined} onSignOut={() => void handleSignOut()} onBack={() => navigateTo({ name: "home" })} />
      ) : (
        <>
          <section className="welcome-panel" id="home">
            <div className="welcome-panel__content">
              <p className="eyebrow">YOUR ENGLISH LEARNING SPACE</p>
              <h1>یادگیری انگلیسی،<br /><span>قدم‌به‌قدم و هدفمند.</span></h1>
              <p className="welcome-panel__description">مسیرت را دنبال کن، تمرین کن و پیشرفت واقعی خودت را ببین.</p>
              <div className="welcome-panel__foot"><span className="welcome-panel__signal" /> مسیر یادگیری از یک درس شروع می‌شود</div>
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

          {sessionMessage && <div className="session-banner" role="status"><span className="session-banner__dot" />{sessionMessage}</div>}

          <section className="learning-overview" aria-label="نمای کلی یادگیری">
            <div className="section-heading"><div><p className="eyebrow">LEARNING OVERVIEW</p><h2>فضای یادگیری تو</h2></div><span className="section-caption">اطلاعات حساب پس از اتصال پروفایل نمایش داده می‌شود</span></div>
            <div className="overview-grid">
              <article className="overview-card overview-card--primary"><span className="overview-card__icon" aria-hidden="true">↗</span><div><strong>مسیر یادگیری</strong><p>از فهرست درس‌های منتشرشده یک درس را انتخاب کن.</p></div></article>
              <article className="overview-card"><span className="overview-card__icon overview-card__icon--mint" aria-hidden="true">✓</span><div><strong>پیشرفت قابل سنجش</strong><p>امتیاز و پیشرفت فقط پس از ثبت معتبر در سرور نمایش داده می‌شود.</p></div></article>
            </div>
          </section>

          <section className="lessons-section" id="lessons" aria-labelledby="lessons-title">
            <div className="section-heading"><div><p className="eyebrow">START LEARNING</p><h2 id="lessons-title">درس‌های در دسترس</h2></div>{lessonState.status === "ready" && <span className="lesson-count">{lessons.length} درس</span>}</div>
            <div className="catalog-toolbar"><label className="catalog-search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجوی عنوان یا سطح درس" aria-label="جست‌وجوی درس‌ها" /></label><span className="catalog-hint">برای مشاهدهٔ محتوای هر درس انتخابش کن</span></div>
            <LessonCatalog lessons={visibleLessons} state={lessonState.status} errorMessage={lessonState.status === "error" ? lessonState.message : undefined} onRetry={() => void loadLessons()} onSelect={(lesson) => navigateTo({ name: "lesson", lessonId: lesson.id })} />
          </section>
          <footer className="footer"><span>یادگیری با استمرار ساخته می‌شود.</span><span className="footer__brand">EnglishCode · MVP</span></footer>
        </>
      )}

      <nav className="mobile-nav" aria-label="ناوبری اصلی">
        <button className={route.name === "home" ? "mobile-nav__item mobile-nav__item--active" : "mobile-nav__item"} type="button" onClick={() => navigateTo({ name: "home" })}><span aria-hidden="true">⌂</span><small>خانه</small></button>
        <button className={route.name === "lesson" ? "mobile-nav__item mobile-nav__item--active" : "mobile-nav__item"} type="button" onClick={() => navigateTo({ name: "home" })}><span aria-hidden="true">▤</span><small>درس‌ها</small></button>
        <button className={activeScreen === "progress" ? "mobile-nav__item mobile-nav__item--active" : "mobile-nav__item"} type="button" onClick={() => { setSelectedLesson(null); setActiveScreen("progress"); }}><span aria-hidden="true">◷</span><small>پیشرفت</small></button>
        <button className={route.name === "profile" ? "mobile-nav__item mobile-nav__item--active" : "mobile-nav__item"} type="button" onClick={() => navigateTo({ name: "profile" })}><span aria-hidden="true">○</span><small>پروفایل</small></button>
      </nav>
    </main>
  );
}
